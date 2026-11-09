"use client"

import {
  useCallback,
  useEffect,
  useId,
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
import { intlLocale, type Locale } from "@eleva/config/i18n"
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
  TimeZoneLine,
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
import { addDaysToKey, dateKeyInZone } from "@eleva/ui/lib/booking/slot-groups"
import { createPublicApiClient } from "@/lib/public-api"
import { downloadBookingIcs } from "@eleva/calendar/ics-download"
import {
  FormCard,
  FunnelStepper,
  StepHeader,
} from "@/components/booking/booking-chrome"
import { BookingDone } from "@/components/booking/booking-done"
import { ExpertAvatar } from "@/components/expert-avatar"
import { Link } from "@/i18n/navigation"
import type { FunnelConsentDoc } from "@/lib/booking-consents"
import {
  bookingReturnUrl,
  checkoutReturnPath,
  updateFunnelReturnPayment,
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

/** Days of open times loaded at once (the slots API allows up to 31). */
const WINDOW_DAYS = 28
/** Empty windows skipped while looking for the first open time (~3 months). */
const MAX_AUTO_SKIPPED_WINDOWS = 2

/** Warn this long before a booking hold ends (WCAG 2.2.1 needs >= 20 s). */
const HOLD_WARNING_MS = 60_000
export function BookingFunnel({
  locale,
  expertName,
  expertHeadline = null,
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
  /** e.g. "Physiotherapist · Lisbon", shown under the expert's name. */
  expertHeadline?: string | null
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
  // First civil day of the loaded window of open times.
  const [fromKey, setFromKey] = useState(() =>
    dateKeyInZone(
      initialSlot?.start ?? new Date().toISOString(),
      resolvedTimeZone(geoTimeZone)
    )
  )
  const windowsToAutoSkip = useRef(MAX_AUTO_SKIPPED_WINDOWS)
  // "Next available": the first open time found when the calendar opens.
  const [earliest, setEarliest] = useState<PublicSlot | null>(null)
  const earliestRef = useRef<PublicSlot | null>(null)
  const seekingEarliest = useRef(true)
  // After a time-zone change, keep the chosen time if it is still open.
  const keepSlotIfOpen = useRef(false)
  const dateLocale = intlLocale(locale)
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
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [holdExtend, setHoldExtend] = useState<
    "idle" | "pending" | "limit" | "failed"
  >("idle")
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

  const fieldId = useId()
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    stepHeadingRef.current?.focus()
  }, [step])

  const inferredMode = shouldSkipMeetStep(modes, {
    memberCountry: country,
    language,
  })
  const selectedMode =
    modes.find(
      (mode) => mode.id === (modeId ?? pinnedModeId ?? inferredMode?.id)
    ) ?? null
  const slotsKey = selectedMode
    ? `${selectedMode.id}:${fromKey}:${timeZone}`
    : ""
  const slotsLoading = Boolean(selectedMode) && slotsRequest.key !== slotsKey
  const slotsError = slotsRequest.key === slotsKey && slotsRequest.error

  useEffect(() => {
    if (!selectedMode) return
    // A day either side of the window covers every UTC offset; the picker
    // shows only days from `fromKey` in the member's zone.
    const from = new Date(`${addDaysToKey(fromKey, -1)}T12:00:00Z`)
    const to = new Date(`${addDaysToKey(fromKey, WINDOW_DAYS)}T12:00:00Z`)
    const api = createPublicApiClient()
    const key = `${selectedMode.id}:${fromKey}:${timeZone}`
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
        const inWindow = result.slots
          .filter((item) => dateKeyInZone(item.start, timeZone) >= fromKey)
          .sort((a, b) => a.start.localeCompare(b.start))
        // An empty strip reads as "unavailable" when the next open time is
        // only weeks away: look further before showing it.
        if (inWindow.length === 0 && windowsToAutoSkip.current > 0) {
          windowsToAutoSkip.current -= 1
          setFromKey(addDaysToKey(fromKey, WINDOW_DAYS))
          return
        }
        windowsToAutoSkip.current = 0
        // "Next available" stays true to what the API just said: it is set
        // by the first window that has a time (even one reached later with
        // "Later dates"), and replaced when a fresh load of its window no
        // longer lists it.
        const known = earliestRef.current
        const knownDay = known ? dateKeyInZone(known.start, timeZone) : null
        const windowEnd = addDaysToKey(fromKey, WINDOW_DAYS)
        const knownGone =
          known != null &&
          knownDay != null &&
          knownDay >= fromKey &&
          knownDay < windowEnd &&
          !result.slots.some((item) => item.start === known.start)
        if ((seekingEarliest.current || knownGone) && inWindow[0]) {
          seekingEarliest.current = false
          earliestRef.current = inWindow[0]
          setEarliest(inWindow[0])
        } else if (knownGone) {
          earliestRef.current = null
          setEarliest(null)
        }
        if (keepSlotIfOpen.current) {
          keepSlotIfOpen.current = false
          setSlot((current) =>
            current && result.slots.some((item) => item.start === current.start)
              ? current
              : null
          )
        }
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
  }, [eventSlug, fromKey, linkToken, selectedMode, timeZone, username])

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
        // Declined after a redirect: back to pay, which offers another try
        // or a restart when the hold has lapsed.
        if (
          error instanceof ApiClientError &&
          error.body?.error === "PAYMENT_FAILED"
        ) {
          setFormError("paymentFailed")
          setConfirmState("idle")
          setStep("pay")
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
    setAppliedPromo(snapshot.promoCode ?? null)
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
  const holdEndingSoon =
    holdActive &&
    !paymentInFlight &&
    new Date(reservation.expiresAt).getTime() - nowMs <= HOLD_WARNING_MS
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
    ? new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone,
      }).format(new Date(slot.start))
    : t("summary.chooseTime")

  const policyCopy = describeCancellationPolicy(cancellationPolicy, locale)
  const deadlineFormat = new Intl.DateTimeFormat(dateLocale, {
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
    if (!selectedMode) return
    // The chosen time is gone (for example after a time-zone change):
    // send the member back to pick another rather than doing nothing.
    if (!slot) {
      setStep("when")
      return
    }
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
      setAppliedPromo(null)
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

  /** WCAG 2.2.1: warn before the hold ends and let the member extend it. */
  async function extendHold() {
    if (!reservation) return
    setHoldExtend("pending")
    try {
      const next = await createPublicApiClient().bookings.extendHold({
        reservationId: reservation.reservationId,
        reservationToken: reservation.reservationToken,
      })
      setReservation({ ...reservation, expiresAt: next.expiresAt })
      setNowMs(Date.now())
      setHoldExtend("idle")
    } catch (error) {
      setHoldExtend(
        error instanceof ApiClientError &&
          error.body?.error === "HOLD_LIMIT_REACHED"
          ? "limit"
          : "failed"
      )
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
        headingRef={stepHeadingRef}
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
      {/* Who they are booking comes first: above the steps on phones,
          beside them on desktop. */}
      <BookingSummary
        expertName={expertName}
        expertHeadline={expertHeadline}
        profileLink={
          <Link
            href={`/${username}`}
            className="font-medium text-primary underline underline-offset-4"
          >
            {t("summary.profile", { name: expertName })}
          </Link>
        }
        offerTitle={offerTitle}
        meta={
          selectedMode
            ? [
                t("meet.duration", { minutes: selectedMode.durationMinutes }),
                locationCopy ?? t(`modes.${selectedMode.mode}.title`),
              ].join(" · ")
            : undefined
        }
        when={whenLabel}
        whenLabel={t("summary.when")}
        priceLabel={t("summary.price")}
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
      <section className="min-w-0">
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
            <StepHeader
              title={t("meet.heading")}
              sub={t("meet.sub")}
              headingRef={stepHeadingRef}
            />
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
                windowsToAutoSkip.current = MAX_AUTO_SKIPPED_WINDOWS
                seekingEarliest.current = true
                earliestRef.current = null
                setEarliest(null)
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
              headingRef={stepHeadingRef}
            />
            <TimeZoneLine
              value={timeZone}
              onChange={(next) => {
                keepSlotIfOpen.current = true
                setTimeZone(next)
              }}
              labels={{
                timesIn: (city) => t("when.timesIn", { city }),
                change: t("when.changeZone"),
                changeAccessible: (city) =>
                  t("when.changeZoneAccessible", { city }),
                field: t("when.zoneField"),
                empty: t("when.zoneEmpty"),
              }}
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
              locale={dateLocale}
              fromKey={fromKey}
              isLoading={slotsLoading}
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
              onLaterDates={() => {
                windowsToAutoSkip.current = 0
                setFromKey(addDaysToKey(fromKey, WINDOW_DAYS))
              }}
              onJumpTo={(key) => {
                windowsToAutoSkip.current = 0
                setFromKey(key)
              }}
              earliest={earliest}
              onSelectEarliest={(next) => {
                windowsToAutoSkip.current = 0
                setFromKey(dateKeyInZone(next.start, timeZone))
                setSlot(
                  earliest && earliest.start === next.start ? earliest : null
                )
              }}
              continueAction={(when) => (
                <Button
                  data-testid="booking-continue-when"
                  size="lg"
                  className="min-h-11 rounded-full"
                  onPress={() => setStep("details")}
                >
                  {t("when.continueWith", { when })}
                </Button>
              )}
              labels={{
                strip: t("when.strip"),
                earlierDays: t("when.earlierDays"),
                laterDays: t("when.laterDays"),
                previous: t("when.previous"),
                next: t("when.next"),
                today: t("when.today"),
                tomorrow: t("when.tomorrow"),
                more: (count) => t("when.more", { count }),
                less: t("when.less"),
                laterDates: t("when.laterDates"),
                chooseDate: t("when.chooseDate"),
                calendar: t("when.calendar"),
                empty: t("when.empty"),
                nextAvailable: (when) => t("when.nextAvailable", { when }),
                timeAccessible: (when) => t("when.timeAccessible", { when }),
                selected: (when) => t("when.selected", { when }),
              }}
            />
            {previousFunnelStep(step, backInput) ? (
              <Button variant="ghost" onPress={goBack}>
                {t("back")}
              </Button>
            ) : null}
          </div>
        ) : null}

        {step === "details" ? (
          <div className="mt-8 space-y-6">
            <StepHeader
              title={t("details.heading")}
              sub={t("details.sub")}
              testId="booking-details-heading"
              headingRef={stepHeadingRef}
            />
            <FormCard title={t("details.sections.contact")}>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-name`}>
                  {t("details.name")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-name`}
                  required
                  data-testid="booking-guest-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-email`}>
                  {t("details.email")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-email`}
                  required
                  data-testid="booking-guest-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-phone`}>
                  {t("details.phone")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-phone`}
                  aria-describedby={`${fieldId}-phone-hint`}
                  aria-invalid={formError === "phoneRequired" || undefined}
                  required={selectedMode?.mode === "phone"}
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                />
                <p
                  id={`${fieldId}-phone-hint`}
                  className="text-sm text-muted-foreground"
                >
                  {t("details.phoneHint")}
                </p>
              </Field>
            </FormCard>
            <FormCard title={t("details.sections.optional")}>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-tax-id`}>
                  {t("details.taxId")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-tax-id`}
                  aria-describedby={`${fieldId}-tax-id-hint`}
                  aria-invalid={formError === "taxIdInvalid" || undefined}
                  data-testid="booking-guest-tax-id"
                  value={taxId}
                  onChange={(event) => setTaxId(event.target.value)}
                  autoComplete="off"
                  inputMode="text"
                />
                <p
                  id={`${fieldId}-tax-id-hint`}
                  className="text-sm text-muted-foreground"
                >
                  {t("details.taxIdHint")}
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-intake`}>
                  {t("details.intakeNotes")}
                </FieldLabel>
                <Textarea
                  id={`${fieldId}-intake`}
                  aria-describedby={`${fieldId}-intake-hint`}
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
                <p
                  id={`${fieldId}-intake-hint`}
                  className="text-sm text-muted-foreground"
                >
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
            <StepHeader
              title={t("pay.heading")}
              sub={t("pay.sub")}
              headingRef={stepHeadingRef}
            >
              {isRequest ? (
                <p className="text-sm text-muted-foreground">
                  {t("pay.requestHint")}
                </p>
              ) : null}
            </StepHeader>
            {formError ? (
              <FieldError>{t(`errors.${formError}`)}</FieldError>
            ) : null}
            {holdEndingSoon ? (
              <div
                className="space-y-3 rounded-xl border border-warning bg-warning-subtle p-4"
                data-testid="booking-hold-ending"
              >
                <p role="alert">
                  {holdExtend === "limit"
                    ? t("pay.extendLimit")
                    : holdExtend === "failed"
                      ? t("pay.extendFailed")
                      : t("pay.holdEnding")}
                </p>
                {holdExtend !== "limit" ? (
                  <Button
                    variant="outline"
                    onPress={extendHold}
                    isDisabled={holdExtend === "pending"}
                  >
                    {t("pay.extend")}
                  </Button>
                ) : null}
              </div>
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
                appliedPromoCode={appliedPromo}
                onPromoCodeChange={async (code) => {
                  try {
                    const next =
                      await createPublicApiClient().payments.checkoutSession({
                        reservationId: reservation.reservationId,
                        reservationToken: reservation.reservationToken,
                        returnPath: checkoutReturnPath(),
                        ...(code ? { promoCode: code } : {}),
                      })
                    setPayment(next)
                    setAppliedPromo(code)
                    // A redirect-based payment returns with the new
                    // session id; keep the restore snapshot in step.
                    updateFunnelReturnPayment(next, code)
                    return null
                  } catch (error) {
                    return error instanceof ApiClientError &&
                      error.body?.error === "PROMO_INVALID"
                      ? t("pay.promoInvalid")
                      : t("pay.promoFailed")
                  }
                }}
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
    </div>
  )
}
