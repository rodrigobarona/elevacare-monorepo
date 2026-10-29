"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslations } from "next-intl"
import {
  ApiClientError,
  type PublicEventTypeMode,
  type PublicSlot,
} from "@eleva/api-client"
import {
  cancellationDeadlines,
  describeCancellationDeadlines,
  describeCancellationPolicy,
  type CancellationPolicy,
} from "@eleva/config/cancellation-policy"
import type { Locale } from "@eleva/config/i18n"
import { BookingCheckoutPayment } from "@eleva/billing/client"
import { Button } from "@eleva/ui/components/button"
import { Field, FieldError, FieldLabel } from "@eleva/ui/components/field"
import { Input } from "@eleva/ui/components/input"
import { Textarea } from "@eleva/ui/components/textarea"
import { BookingSummary } from "@eleva/ui/components/booking/booking-summary"
import { CancellationPolicySummary } from "@eleva/ui/components/booking/cancellation-policy-summary"
import { ConsentCheckbox } from "@eleva/ui/components/booking/consent-checkbox"
import { CountrySelect } from "@eleva/ui/components/booking/country-select"
import { LanguageChips } from "@eleva/ui/components/booking/language-chips"
import {
  ModeCards,
  type ModeCardItem,
} from "@eleva/ui/components/booking/mode-cards"
import { SlotPicker } from "@eleva/ui/components/booking/slot-picker"
import {
  TimezoneSelect,
  resolvedTimeZone,
} from "@eleva/ui/components/booking/timezone-select"
import { formatBookingPrice } from "@eleva/ui/components/booking/price-tag"
import {
  evaluateModes,
  shouldSkipMeetStep,
} from "@eleva/ui/lib/booking/mode-bookable"
import { formatCountdown, isExpired } from "@eleva/ui/lib/booking/countdown"
import { displayLanguage } from "@eleva/ui/lib/booking/display-names"
import { toE164 } from "@eleva/ui/lib/booking/e164"
import { maskPhone } from "@eleva/config/phone"
import { slotRequiresApproval } from "@eleva/config/booking-settings"
import { addMonths, startOfMonth } from "@eleva/ui/lib/booking/slot-groups"
import { createPublicApiClient } from "@/lib/public-api"
import { downloadBookingIcs } from "@eleva/calendar/ics-download"
import {
  FormCard,
  FunnelStepper,
  StepHeader,
} from "@/components/booking/booking-chrome"
import { BookingDone } from "@/components/booking/booking-done"
import { ExpertAvatar } from "@/components/expert-avatar"
import type { FunnelConsentDoc } from "@/lib/booking-consents"
import {
  bookingReturnUrl,
  checkoutReturnPath,
  clearFunnelReturn,
  confirmLockKey,
  consumeFunnelRestore,
  releaseConfirmLock,
  saveFunnelReturn,
  takeFunnelRestore,
  tryAcquireConfirmLock,
} from "@/lib/funnel-return"
import {
  initialFunnelLanguage,
  initialFunnelStep,
  mapConfirmError,
  mapReserveError,
  previousFunnelStep,
  type FunnelStep,
} from "@/lib/funnel-state"
import { pickLocalizedText, type LocalizedText } from "@/lib/localized-text"

type Reservation = {
  reservationId: string
  reservationToken: string
  expiresAt: string
  /** Server decision at reserve; absent on holds saved before it existed. */
  requiresApproval?: boolean
}

type Payment = {
  clientSecret: string
  checkoutSessionId: string
  bookingId: string
  publishableKey: string
}

export function BookingFunnel({
  locale,
  expertName,
  expertAvatarUrl = null,
  username,
  eventSlug,
  title,
  modes,
  cancellationPolicy,
  requiresApproval = false,
  instantBookLeadMinutes = null,
  geoCountry,
  geoTimeZone,
  consents,
  aiProcessingConsent,
  linkToken,
  linkNote,
  specialPriceCents,
  pinnedModeId,
  initialModeId,
  initialSlot,
}: {
  locale: Locale
  expertName: string
  expertAvatarUrl?: string | null
  username: string
  eventSlug: string
  title: LocalizedText
  modes: PublicEventTypeMode[]
  cancellationPolicy: CancellationPolicy
  requiresApproval?: boolean
  instantBookLeadMinutes?: number | null
  geoCountry: string
  geoTimeZone: string
  consents: FunnelConsentDoc[]
  aiProcessingConsent: { version: string; href: string }
  linkToken?: string
  linkNote?: string | null
  specialPriceCents?: number | null
  pinnedModeId?: string | null
  initialModeId?: string | null
  initialSlot?: PublicSlot | null
}) {
  const t = useTranslations("booking")
  const offerTitle = pickLocalizedText(title, locale)
  const languageOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const mode of modes) {
      for (const language of mode.languages)
        ids.add(language.split("-")[0] ?? language)
    }
    return [...ids].map((id) => ({
      id,
      label: t.has(`languages.${id}` as "languages.en")
        ? t(`languages.${id}` as "languages.en")
        : displayLanguage(id, locale),
    }))
  }, [locale, modes, t])

  const [country, setCountry] = useState(geoCountry)
  const [language, setLanguage] = useState(() =>
    initialFunnelLanguage(
      locale,
      modes.flatMap((mode) => mode.languages)
    )
  )
  const [timeZone, setTimeZone] = useState(() => resolvedTimeZone(geoTimeZone))
  const [modeId, setModeId] = useState<string | null>(
    pinnedModeId ?? initialModeId ?? null
  )
  const [slot, setSlot] = useState<PublicSlot | null>(initialSlot ?? null)
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [slotsRequest, setSlotsRequest] = useState<{
    key: string
    error: boolean
  }>({ key: "", error: false })
  const [month, setMonth] = useState(() =>
    startOfMonth(initialSlot ? new Date(initialSlot.start) : new Date())
  )
  const [view, setView] = useState<"month" | "week">("month")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [taxId, setTaxId] = useState("")
  const [intakeNotes, setIntakeNotes] = useState("")
  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const [aiOptIn, setAiOptIn] = useState(false)
  const aiProcessingHref = aiProcessingConsent?.href
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentInFlight, setPaymentInFlight] = useState(false)
  const [confirmState, setConfirmState] = useState<
    "idle" | "pending" | "confirmed" | "failed"
  >("idle")
  const [settledStatus, setSettledStatus] = useState<
    "confirmed" | "awaiting_confirmation" | null
  >(null)
  const confirmInFlight = useRef(false)
  const isRequest =
    settledStatus != null
      ? settledStatus === "awaiting_confirmation"
      : reservation?.requiresApproval != null
        ? reservation.requiresApproval
        : slot
          ? slotRequiresApproval({
              requiresApproval,
              instantBookLeadMinutes,
              startsAt: new Date(slot.start),
              now: new Date(nowMs),
            })
          : requiresApproval

  const evaluations = evaluateModes(modes, {
    memberCountry: country,
    language,
  })
  const skipMeet =
    Boolean(pinnedModeId) ||
    shouldSkipMeetStep(modes, { memberCountry: country, language }) != null
  const skipToDetails = Boolean(initialSlot && (pinnedModeId ?? initialModeId))
  const backInput = { pinnedModeId, skipToWhen: skipMeet }
  const [step, setStep] = useState<FunnelStep>(() =>
    initialFunnelStep({
      pinnedModeId,
      skipToWhen: skipMeet || Boolean(initialModeId),
      skipToDetails,
    })
  )

  const inferredMode = shouldSkipMeetStep(modes, {
    memberCountry: country,
    language,
  })
  const selectedMode =
    modes.find(
      (mode) => mode.id === (modeId ?? pinnedModeId ?? inferredMode?.id)
    ) ?? null
  const slotsKey = selectedMode
    ? `${selectedMode.id}:${month.toISOString()}:${timeZone}`
    : ""
  const slotsLoading = Boolean(selectedMode) && slotsRequest.key !== slotsKey
  const slotsError = slotsRequest.key === slotsKey && slotsRequest.error

  useEffect(() => {
    if (!selectedMode) return
    const from = startOfMonth(month)
    const nextMonthPlusDay = addMonths(month, 1).getTime() + 24 * 60 * 60 * 1000
    const maxRange = from.getTime() + 31 * 24 * 60 * 60 * 1000
    const to = new Date(Math.min(nextMonthPlusDay, maxRange))
    const api = createPublicApiClient()
    const key = `${selectedMode.id}:${month.toISOString()}:${timeZone}`
    let cancelled = false
    api.public
      .getSlots(username, eventSlug, {
        modeId: selectedMode.id,
        from: from.toISOString(),
        to: to.toISOString(),
        tz: timeZone,
        ...(linkToken ? { linkToken } : {}),
      })
      .then((result) => {
        if (cancelled) return
        setSlots(result.slots)
        setSlotsRequest({ key, error: false })
      })
      .catch(() => {
        if (cancelled) return
        setSlots([])
        setSlotsRequest({ key, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [eventSlug, linkToken, month, selectedMode, timeZone, username])

  const confirmPaidHold = useCallback(
    async (hold: Reservation, paid: Payment) => {
      const lockKey = confirmLockKey(hold.reservationId, paid.checkoutSessionId)
      if (confirmInFlight.current || !tryAcquireConfirmLock(lockKey)) return
      confirmInFlight.current = true
      setConfirmState("pending")
      setFormError(null)
      try {
        const api = createPublicApiClient()
        const result = await api.bookings.confirm({
          reservationId: hold.reservationId,
          reservationToken: hold.reservationToken,
          checkoutSessionId: paid.checkoutSessionId,
        })
        setPayment({ ...paid, bookingId: result.bookingId })
        setSettledStatus(result.status)
        setConfirmState("confirmed")
        clearFunnelReturn()
      } catch (error) {
        releaseConfirmLock(lockKey)
        // Stripe has the payment but it has not settled (e.g. MB WAY waiting
        // for approval in the app): the webhook confirms; show pending.
        if (
          error instanceof ApiClientError &&
          error.body?.error === "PAYMENT_PENDING"
        ) {
          setConfirmState("pending")
          return
        }
        if (error instanceof ApiClientError) {
          setFormError(mapConfirmError(error.body?.error))
        } else {
          setFormError("confirmFailed")
        }
        setConfirmState("failed")
      } finally {
        confirmInFlight.current = false
      }
    },
    []
  )

  const onDetails = step === "details"
  const onPay = step === "pay"
  useEffect(() => {
    if (step === "done") return
    if (!reservation && !onDetails) return
    setNowMs(Date.now())
    const id = window.setInterval(
      () => setNowMs(Date.now()),
      reservation && onPay ? 1000 : 30_000
    )
    return () => window.clearInterval(id)
  }, [reservation, onDetails, onPay, step])

  // Layout effect so Stripe query params are read before next-intl / App
  // Router client navigations can strip search (setTimeout(0) was too late).
  // Module memo in takeFunnelRestore survives Strict Mode remounts.
  useLayoutEffect(() => {
    const restored = takeFunnelRestore()
    if (!restored) return
    const { status, snapshot } = restored
    setReservation(snapshot.reservation)
    setPayment(snapshot.payment)
    setSlot(snapshot.slot)
    setModeId(snapshot.modeId)
    setName(snapshot.name)
    setEmail(snapshot.email)
    setPhone(snapshot.phone)
    setTimeZone(resolvedTimeZone(snapshot.timeZone))
    setCountry(snapshot.country)
    if (
      snapshot.language === "en" ||
      snapshot.language === "pt" ||
      snapshot.language === "es"
    ) {
      setLanguage(snapshot.language)
    }
    if (status === "succeeded") {
      setStep("done")
      void confirmPaidHold(snapshot.reservation, snapshot.payment)
    } else if (status === "processing") {
      consumeFunnelRestore()
      setConfirmState("pending")
      setStep("done")
    } else {
      // Keep the snapshot so a later Stripe retry can restore confirmation.
      setFormError("generic")
      setStep("pay")
    }
    window.history.replaceState({}, "", bookingReturnUrl())
  }, [confirmPaidHold])

  const holdExpired =
    reservation != null &&
    !paymentInFlight &&
    isExpired(reservation.expiresAt, nowMs)
  const holdActive =
    reservation != null && !isExpired(reservation.expiresAt, nowMs)
  const priceCents =
    specialPriceCents ?? selectedMode?.priceCents ?? modes[0]?.priceCents ?? 0
  const extraCountries = useMemo(
    () => modes.flatMap((mode) => mode.countryScopeCodes),
    [modes]
  )

  const cards: ModeCardItem[] = evaluations.map(({ mode, result }) => ({
    id: mode.id,
    kind: mode.mode,
    title:
      mode.mode === "in_person" && mode.location
        ? mode.location.name
        : t(`modes.${mode.mode}.title`),
    description: t(`modes.${mode.mode}.description`),
    locationName: mode.location?.name,
    city: mode.location?.city,
    priceCents: specialPriceCents ?? mode.priceCents,
    durationMinutes: mode.durationMinutes,
    disabled: !result.ok,
    disabledReason: result.ok ? undefined : result.error,
  }))

  const whenLabel = slot
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone,
      }).format(new Date(slot.start))
    : t("summary.chooseTime")

  const policyCopy = describeCancellationPolicy(cancellationPolicy, locale)
  const deadlineFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })
  const policyDeadlines = slot
    ? describeCancellationDeadlines(
        cancellationDeadlines({
          policy: cancellationPolicy,
          bookedAt: new Date(nowMs),
          startsAt: new Date(slot.start),
        }),
        locale,
        (date) => deadlineFormat.format(date)
      )
    : undefined

  const locationCopy = selectedMode
    ? selectedMode.mode === "in_person" && selectedMode.location
      ? `${selectedMode.location.name}, ${selectedMode.location.city}`
      : t(`modes.${selectedMode.mode}.title`)
    : undefined

  function goBack() {
    const previous = previousFunnelStep(step, backInput)
    if (previous) setStep(previous)
  }

  async function holdAndPay() {
    if (!selectedMode || !slot) return
    const typedPhone = phone.trim().length > 0
    const e164 = typedPhone ? toE164(phone, country) : undefined
    if ((selectedMode.mode === "phone" || typedPhone) && !e164) {
      setFormError("phoneRequired")
      return
    }
    if (!consents.every((doc) => granted[doc.kind])) {
      setFormError("consentsRequired")
      return
    }
    const normalizedTaxId = taxId.replace(/[\s.-]/g, "").toUpperCase()
    if (normalizedTaxId && !/^[A-Z0-9]{8,32}$/.test(normalizedTaxId)) {
      setFormError("taxIdInvalid")
      return
    }

    setIsSubmitting(true)
    setFormError(null)
    setNowMs(Date.now())
    const api = createPublicApiClient()
    try {
      const activeHold =
        reservation && new Date(reservation.expiresAt).getTime() > Date.now()
          ? reservation
          : null
      const reserved =
        activeHold ??
        (await api.bookings.reserve({
          username,
          eventTypeModeId: selectedMode.id,
          startsAt: slot.start,
          endsAt: slot.end,
          timezone: timeZone,
          language,
          memberCountry: country,
          ...(linkToken ? { linkToken } : {}),
          guest: {
            email,
            name,
            ...(e164 ? { phone: e164 } : {}),
            ...(normalizedTaxId ? { taxId: normalizedTaxId } : {}),
          },
          ...(e164 ? { phone: e164 } : {}),
          ...(intakeNotes.trim() ? { intakeNotes: intakeNotes.trim() } : {}),
          consents: consents.map((doc) => ({
            kind: doc.kind,
            version: doc.version,
          })),
          ...(aiOptIn ? { aiProcessing: true } : {}),
          cancellationPolicy,
        }))
      if (!activeHold) setReservation(reserved)
      if (priceCents === 0) {
        const confirmed = await api.bookings.confirm({
          reservationId: reserved.reservationId,
          reservationToken: reserved.reservationToken,
        })
        setPayment({
          clientSecret: "",
          checkoutSessionId: "",
          bookingId: confirmed.bookingId,
          publishableKey: "",
        })
        setSettledStatus(confirmed.status)
        setConfirmState("confirmed")
        setStep("done")
        return
      }
      const session = await api.payments.checkoutSession({
        reservationId: reserved.reservationId,
        reservationToken: reserved.reservationToken,
        returnPath: checkoutReturnPath(),
      })
      setPayment(session)
      saveFunnelReturn({
        reservation: reserved,
        payment: session,
        slot,
        modeId: selectedMode.id,
        name,
        email,
        phone,
        timeZone,
        country,
        language,
      })
      setStep("pay")
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(mapReserveError(error.body?.error))
      } else {
        setFormError("generic")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function restart() {
    setReservation(null)
    setPayment(null)
    setSlot(null)
    setFormError(null)
    setPaymentInFlight(false)
    setConfirmState("idle")
    confirmInFlight.current = false
    setStep(
      initialFunnelStep({
        pinnedModeId,
        skipToWhen: skipMeet || Boolean(modeId ?? initialModeId),
      })
    )
  }

  const flowSteps: FunnelStep[] = [
    ...(skipMeet ? [] : (["meet"] as const)),
    "when",
    "details",
    ...(priceCents > 0 ? (["pay"] as const) : []),
  ]
  const stepIndex = flowSteps.indexOf(step)
  const expertMedia = (
    <ExpertAvatar
      displayName={expertName}
      username={username}
      avatarUrl={expertAvatarUrl}
    />
  )
  const signupHref = `/signup?${new URLSearchParams({
    name,
    email,
    ...(phone ? { phone } : {}),
  }).toString()}`

  if (step === "done" && slot && selectedMode) {
    const accessNote =
      selectedMode.mode === "phone"
        ? t("done.phone", {
            phone: maskPhone(toE164(phone, country) ?? phone),
          })
        : selectedMode.mode === "in_person" && selectedMode.location
          ? t("done.inPerson", {
              location: `${selectedMode.location.name}, ${selectedMode.location.city}`,
            })
          : t("done.video")
    return (
      <BookingDone
        confirmState={confirmState}
        isRequest={isRequest}
        errorMessage={formError ? t(`errors.${formError}`) : null}
        onRetry={
          reservation && payment
            ? () => void confirmPaidHold(reservation, payment)
            : undefined
        }
        expertName={expertName}
        offerTitle={offerTitle}
        media={expertMedia}
        whenLabel={whenLabel}
        modeLabel={locationCopy ?? t(`modes.${selectedMode.mode}.title`)}
        priceLabel={formatBookingPrice(priceCents, locale)}
        accessNote={accessNote}
        policyName={policyCopy.name}
        isOnline={selectedMode.mode === "online"}
        signupHref={signupHref}
        onAddToCalendar={() =>
          downloadBookingIcs({
            uid: payment?.bookingId ?? reservation?.reservationId ?? eventSlug,
            summary: `${offerTitle} · ${expertName}`,
            description: accessNote,
            start: slot.start,
            end: slot.end,
            timeZone,
            location:
              selectedMode.mode === "in_person"
                ? locationCopy
                : selectedMode.mode === "phone"
                  ? t("done.phoneLocation", {
                      phone: maskPhone(toE164(phone, country) ?? phone),
                    })
                  : t("done.videoLocation"),
            expertName,
            memberName: name,
            memberEmail: email,
          })
        }
      />
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
      <section>
        {stepIndex >= 0 ? (
          <FunnelStepper
            label={`${t("stepOf", { current: stepIndex + 1, total: flowSteps.length })} · ${t(`steps.${step}`)}`}
            total={flowSteps.length}
            current={stepIndex}
          />
        ) : null}

        {linkNote ? (
          <aside
            data-testid="booking-link-note"
            className="mt-6 rounded-3xl bg-primary/8 px-4 py-3 text-sm"
          >
            <p className="font-medium">{t("link.noteHeading")}</p>
            <p className="mt-1 text-muted-foreground">{linkNote}</p>
          </aside>
        ) : null}

        {step === "meet" ? (
          <div className="mt-8 space-y-8">
            <StepHeader title={t("meet.heading")} sub={t("meet.sub")} />
            <CountrySelect
              value={country}
              onChange={(next) => {
                setCountry(next)
                setSlot(null)
              }}
              locale={locale}
              extraCodes={extraCountries}
              label={t("meet.countryLabel")}
              description={t("meet.countryHint")}
            />
            {languageOptions.length > 1 ||
            (languageOptions.length === 1 &&
              languageOptions[0]?.id !== language) ? (
              <LanguageChips
                languages={languageOptions}
                selectedKey={language}
                onSelectionChange={(id) => {
                  if (id === "en" || id === "pt" || id === "es") {
                    setLanguage(id)
                    setSlot(null)
                  }
                }}
                label={t("meet.languageLabel")}
              />
            ) : null}
            <ModeCards
              modes={cards}
              selectedKey={modeId}
              onSelectionChange={(id) => {
                setModeId(id)
                setSlot(null)
              }}
              locale={locale}
              label={t("meet.heading")}
              reasonCopy={{
                MODE_NOT_AVAILABLE_IN_COUNTRY: t("meet.reasons.country"),
                MODE_LANGUAGE_MISMATCH: t("meet.reasons.language"),
                MODE_INACTIVE: t("meet.reasons.inactive"),
              }}
              alternativeHint={t("meet.alternativeHint")}
              durationLabel={(minutes) => t("meet.duration", { minutes })}
            />
            <Button
              data-testid="booking-continue-meet"
              isDisabled={!selectedMode}
              onPress={() => setStep("when")}
            >
              {t("meet.continue")}
            </Button>
          </div>
        ) : null}

        {step === "when" ? (
          <div className="mt-8 space-y-6">
            <StepHeader
              title={t("when.heading")}
              sub={t("when.sub")}
              testId="booking-when-heading"
            />
            <TimezoneSelect
              value={timeZone}
              onChange={(next) => {
                setTimeZone(next)
                setSlot(null)
              }}
              label={t("when.timezone")}
            />
            {slotsLoading ? (
              <p
                data-testid="booking-slots-loading"
                className="text-sm text-muted-foreground"
              >
                {t("when.loading")}
              </p>
            ) : null}
            {slotsError ? (
              <p
                role="alert"
                data-testid="booking-slots-error"
                className="text-sm text-destructive"
              >
                {t("when.loadError")}
              </p>
            ) : null}
            <SlotPicker
              slots={slots}
              timeZone={timeZone}
              locale={locale}
              selectedStart={slot?.start ?? null}
              onSelect={(next) => {
                const match = slots.find((item) => item.start === next.start)
                setSlot(
                  match ?? {
                    start: next.start,
                    end: next.end,
                    startLocal: "",
                    endLocal: "",
                  }
                )
              }}
              month={month}
              onMonthChange={(next) => {
                setMonth(next)
                setSlot(null)
              }}
              view={view}
              onViewChange={setView}
              labels={{
                month: t("when.month"),
                week: t("when.week"),
                previous: t("when.previous"),
                next: t("when.next"),
                empty: t("when.empty"),
                weekday: [
                  t("when.weekdays.mon"),
                  t("when.weekdays.tue"),
                  t("when.weekdays.wed"),
                  t("when.weekdays.thu"),
                  t("when.weekdays.fri"),
                  t("when.weekdays.sat"),
                  t("when.weekdays.sun"),
                ],
              }}
            />
            <div className="flex gap-3">
              {previousFunnelStep(step, backInput) ? (
                <Button variant="ghost" onPress={goBack}>
                  {t("back")}
                </Button>
              ) : null}
              <Button
                data-testid="booking-continue-when"
                isDisabled={!slot}
                onPress={() => setStep("details")}
              >
                {t("when.continue")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "details" ? (
          <div className="mt-8 space-y-6">
            <StepHeader
              title={t("details.heading")}
              sub={t("details.sub")}
              testId="booking-details-heading"
            />
            <FormCard title={t("details.sections.contact")}>
              <Field>
                <FieldLabel>{t("details.name")}</FieldLabel>
                <Input
                  data-testid="booking-guest-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field>
                <FieldLabel>{t("details.email")}</FieldLabel>
                <Input
                  data-testid="booking-guest-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field>
                <FieldLabel>{t("details.phone")}</FieldLabel>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
                <p className="text-sm text-muted-foreground">
                  {t("details.phoneHint")}
                </p>
              </Field>
            </FormCard>
            <FormCard title={t("details.sections.optional")}>
              <Field>
                <FieldLabel>{t("details.taxId")}</FieldLabel>
                <Input
                  data-testid="booking-guest-tax-id"
                  value={taxId}
                  onChange={(event) => setTaxId(event.target.value)}
                  autoComplete="off"
                  inputMode="text"
                />
                <p className="text-sm text-muted-foreground">
                  {t("details.taxIdHint")}
                </p>
              </Field>
              <Field>
                <FieldLabel>{t("details.intakeNotes")}</FieldLabel>
                <Textarea
                  data-testid="booking-intake-notes"
                  value={intakeNotes}
                  onChange={(event) => {
                    if (holdActive) return
                    setIntakeNotes(event.target.value)
                  }}
                  maxLength={8000}
                  readOnly={holdActive}
                  className={
                    holdActive ? "cursor-not-allowed opacity-50" : undefined
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {t("details.intakeNotesHint")}
                </p>
              </Field>
            </FormCard>
            <FormCard title={t("details.sections.confirm")}>
              <CancellationPolicySummary
                heading={t("policy.heading")}
                name={policyCopy.name}
                lines={policyCopy.lines}
                deadlines={policyDeadlines}
                className="rounded-2xl bg-muted/60 p-4"
              />
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("details.consentsIntro")}
                </p>
                {consents.map((doc) => (
                  <ConsentCheckbox
                    key={doc.kind}
                    id={doc.kind}
                    isSelected={Boolean(granted[doc.kind])}
                    onChange={(selected) =>
                      setGranted((current) => ({
                        ...current,
                        [doc.kind]: selected,
                      }))
                    }
                    label={t(`details.consents.${doc.kind}.label`)}
                    href={doc.href}
                    linkLabel={t(`details.consents.${doc.kind}.link`)}
                  />
                ))}
                {aiProcessingHref ? (
                  <ConsentCheckbox
                    id="ai_processing"
                    isSelected={aiOptIn}
                    onChange={setAiOptIn}
                    label={t("details.aiConsent.label")}
                    href={aiProcessingHref}
                    linkLabel={t("details.aiConsent.link")}
                  />
                ) : null}
              </div>
            </FormCard>
            {formError ? (
              <FieldError>{t(`errors.${formError}`)}</FieldError>
            ) : null}
            <div className="flex gap-3">
              <Button variant="ghost" onPress={goBack}>
                {t("back")}
              </Button>
              <Button
                data-testid="booking-continue-details"
                isDisabled={
                  !name.trim() || !email.includes("@") || isSubmitting
                }
                onPress={() => void holdAndPay()}
              >
                {isSubmitting
                  ? t("details.holding")
                  : priceCents === 0
                    ? t("details.confirmFree")
                    : t("details.hold")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "pay" && payment && reservation ? (
          <div className="mt-8 space-y-6">
            <StepHeader title={t("pay.heading")} sub={t("pay.sub")}>
              {isRequest ? (
                <p className="text-sm text-muted-foreground">
                  {t("pay.requestHint")}
                </p>
              ) : null}
            </StepHeader>
            {formError ? (
              <FieldError>{t(`errors.${formError}`)}</FieldError>
            ) : null}
            {holdExpired ? (
              <div className="space-y-3">
                <p role="alert">{t("pay.expired")}</p>
                <Button onPress={restart}>{t("pay.restart")}</Button>
              </div>
            ) : (
              <BookingCheckoutPayment
                publishableKey={payment.publishableKey}
                clientSecret={payment.clientSecret}
                locale={locale}
                labels={{
                  loading: t("pay.loading"),
                  loadFailed: t("pay.loadFailed"),
                  promo: t("details.promo"),
                  promoHint: t("details.promoHint"),
                  promoApply: t("pay.promoApply"),
                  promoRemove: t("pay.promoRemove"),
                  promoInvalid: t("pay.promoInvalid"),
                  subtotal: t("pay.subtotal"),
                  discount: t("pay.discount"),
                  total: t("pay.total"),
                  pay: (total) => t("pay.pay", { price: total }),
                  processing: t("pay.processing"),
                  failed: t("pay.failed"),
                }}
                onProcessingChange={setPaymentInFlight}
                onSettled={() => {
                  // The API decides: confirmed, or 409 PAYMENT_PENDING while
                  // the payment settles (the webhook then confirms).
                  setStep("done")
                  void confirmPaidHold(reservation, payment)
                }}
              />
            )}
          </div>
        ) : null}
      </section>

      <BookingSummary
        expertName={expertName}
        offerTitle={offerTitle}
        when={whenLabel}
        whenLabel={t("summary.when")}
        priceLabel={t("summary.price")}
        modeLabel={t("summary.mode")}
        modeValue={
          selectedMode
            ? t(`modes.${selectedMode.mode}.title`)
            : t("summary.chooseTime")
        }
        location={locationCopy}
        priceCents={priceCents}
        locale={locale}
        specialPrice={specialPriceCents != null}
        specialPriceLabel={t("link.specialPrice")}
        holdLabel={
          onPay && reservation && !holdExpired
            ? t("pay.hold", {
                time: formatCountdown(
                  Math.max(0, new Date(reservation.expiresAt).getTime() - nowMs)
                ),
              })
            : undefined
        }
        media={expertMedia}
        footer={t("summary.policy", { policy: policyCopy.name })}
      />
    </div>
  )
}
