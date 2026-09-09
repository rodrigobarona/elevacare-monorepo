"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ApiClientError,
  type PublicEventTypeMode,
  type PublicSlot,
} from "@eleva/api-client"
import type { Locale } from "@eleva/config/i18n"
import { BookingPaymentElement } from "@eleva/billing/client"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Field, FieldError, FieldLabel } from "@eleva/ui/components/field"
import { Input } from "@eleva/ui/components/input"
import { BookingSummary } from "@eleva/ui/components/booking/booking-summary"
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
import { maskPhone, toE164 } from "@eleva/ui/lib/booking/e164"
import { startOfMonth } from "@eleva/ui/lib/booking/slot-groups"
import { createPublicApiClient } from "@/lib/public-api"
import { downloadBookingIcs } from "@/lib/booking-ics"
import type { FunnelConsentDoc } from "@/lib/booking-consents"
import {
  bookingReturnUrl,
  clearFunnelReturn,
  loadFunnelReturn,
  parseRedirectStatus,
  saveFunnelReturn,
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
}

type Payment = {
  clientSecret: string
  paymentIntentId: string
  bookingId: string
  publishableKey: string
}

export function BookingFunnel({
  locale,
  expertName,
  username,
  eventSlug,
  title,
  modes,
  geoCountry,
  geoTimeZone,
  consents,
  linkToken,
  linkNote,
  specialPriceCents,
  pinnedModeId,
}: {
  locale: Locale
  expertName: string
  username: string
  eventSlug: string
  title: LocalizedText
  modes: PublicEventTypeMode[]
  geoCountry: string
  geoTimeZone: string
  consents: FunnelConsentDoc[]
  linkToken?: string
  linkNote?: string | null
  specialPriceCents?: number | null
  pinnedModeId?: string | null
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
        : id,
    }))
  }, [modes, t])

  const [country, setCountry] = useState(geoCountry)
  const [language, setLanguage] = useState(() =>
    initialFunnelLanguage(
      locale,
      modes.flatMap((mode) => mode.languages)
    )
  )
  const [timeZone, setTimeZone] = useState(() => resolvedTimeZone(geoTimeZone))
  const [modeId, setModeId] = useState<string | null>(pinnedModeId ?? null)
  const [slot, setSlot] = useState<PublicSlot | null>(null)
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [slotsRequest, setSlotsRequest] = useState<{
    key: string
    error: boolean
  }>({ key: "", error: false })
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [view, setView] = useState<"month" | "week">("month")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentInFlight, setPaymentInFlight] = useState(false)
  const [confirmState, setConfirmState] = useState<
    "idle" | "pending" | "confirmed" | "failed"
  >("idle")
  const confirmInFlight = useRef(false)

  const evaluations = evaluateModes(modes, {
    memberCountry: country,
    language,
  })
  const skipToWhen =
    Boolean(pinnedModeId) ||
    shouldSkipMeetStep(modes, { memberCountry: country, language }) != null
  const [step, setStep] = useState<FunnelStep>(() =>
    initialFunnelStep({ pinnedModeId, skipToWhen })
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
    const to = new Date(from.getTime() + 42 * 24 * 60 * 60 * 1000)
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
      if (confirmInFlight.current) return
      confirmInFlight.current = true
      setConfirmState("pending")
      setFormError(null)
      try {
        const api = createPublicApiClient()
        const result = await api.bookings.confirm({
          reservationId: hold.reservationId,
          reservationToken: hold.reservationToken,
          paymentIntentId: paid.paymentIntentId,
        })
        setPayment((current) =>
          current ? { ...current, bookingId: result.bookingId } : current
        )
        setConfirmState("confirmed")
      } catch (error) {
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

  useEffect(() => {
    if (!reservation) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [reservation])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const status = parseRedirectStatus(window.location.search)
      if (!status) return
      const snapshot = loadFunnelReturn({
        allowExpired: status === "succeeded" || status === "processing",
      })
      if (!snapshot) return
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
        setConfirmState("pending")
        setStep("done")
      } else {
        setFormError("generic")
        setStep("pay")
      }
      clearFunnelReturn()
      window.history.replaceState({}, "", bookingReturnUrl())
    }, 0)
    return () => window.clearTimeout(id)
  }, [confirmPaidHold])

  const holdExpired =
    reservation != null &&
    !paymentInFlight &&
    isExpired(reservation.expiresAt, nowMs)
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

  const locationCopy = selectedMode
    ? selectedMode.mode === "in_person" && selectedMode.location
      ? `${selectedMode.location.name}, ${selectedMode.location.city}`
      : t(`modes.${selectedMode.mode}.title`)
    : undefined

  function goBack() {
    const previous = previousFunnelStep(step, { pinnedModeId, skipToWhen })
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

    setIsSubmitting(true)
    setFormError(null)
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
          },
          ...(e164 ? { phone: e164 } : {}),
          consents: consents.map((doc) => ({
            kind: doc.kind,
            version: doc.version,
          })),
        }))
      if (!activeHold) setReservation(reserved)
      const intent = await api.payments.intent({
        reservationId: reserved.reservationId,
        reservationToken: reserved.reservationToken,
      })
      setPayment(intent)
      saveFunnelReturn({
        reservation: reserved,
        payment: intent,
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
    setStep(initialFunnelStep({ pinnedModeId, skipToWhen }))
  }

  const progress =
    step === "meet"
      ? 20
      : step === "when"
        ? 40
        : step === "details"
          ? 65
          : step === "pay"
            ? 85
            : 100

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section>
        <p className="text-sm font-medium tracking-widest text-primary uppercase">
          {t(`steps.${step}`)}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {linkNote ? (
          <aside className="mt-6 rounded-3xl bg-primary/8 px-4 py-3 text-sm">
            <p className="font-medium">{t("link.noteHeading")}</p>
            <p className="mt-1 text-muted-foreground">{linkNote}</p>
          </aside>
        ) : null}

        {step === "meet" ? (
          <div className="mt-8 space-y-8">
            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                {t("meet.heading")}
              </h1>
              <p className="text-muted-foreground">{t("meet.sub")}</p>
            </header>
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
            <header className="space-y-2">
              <h1
                data-testid="booking-when-heading"
                className="font-heading text-3xl font-semibold tracking-tight"
              >
                {t("when.heading")}
              </h1>
              <p className="text-muted-foreground">{t("when.sub")}</p>
            </header>
            <TimezoneSelect
              value={timeZone}
              onChange={(next) => {
                setTimeZone(next)
                setSlot(null)
              }}
              label={t("when.timezone")}
            />
            {slotsLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("when.loading")}
              </p>
            ) : null}
            {slotsError ? (
              <p role="alert" className="text-sm text-destructive">
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
              {previousFunnelStep(step, { pinnedModeId, skipToWhen }) ? (
                <Button variant="ghost" onPress={goBack}>
                  {t("back")}
                </Button>
              ) : null}
              <Button isDisabled={!slot} onPress={() => setStep("details")}>
                {t("when.continue")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "details" ? (
          <div className="mt-8 space-y-6">
            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                {t("details.heading")}
              </h1>
              <p className="text-muted-foreground">{t("details.sub")}</p>
            </header>
            <Field>
              <FieldLabel>{t("details.name")}</FieldLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field>
              <FieldLabel>{t("details.email")}</FieldLabel>
              <Input
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
            </div>
            {formError ? (
              <FieldError>{t(`errors.${formError}`)}</FieldError>
            ) : null}
            <div className="flex gap-3">
              <Button variant="ghost" onPress={goBack}>
                {t("back")}
              </Button>
              <Button
                isDisabled={
                  !name.trim() || !email.includes("@") || isSubmitting
                }
                onPress={() => void holdAndPay()}
              >
                {isSubmitting ? t("details.holding") : t("details.hold")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "pay" && payment && reservation ? (
          <div className="mt-8 space-y-6">
            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                {t("pay.heading")}
              </h1>
              <p className="text-muted-foreground">{t("pay.sub")}</p>
            </header>
            {formError ? (
              <FieldError>{t(`errors.${formError}`)}</FieldError>
            ) : null}
            {holdExpired ? (
              <div className="space-y-3">
                <p role="alert">{t("pay.expired")}</p>
                <Button onPress={restart}>{t("pay.restart")}</Button>
              </div>
            ) : (
              <BookingPaymentElement
                publishableKey={payment.publishableKey}
                clientSecret={payment.clientSecret}
                locale={locale}
                returnUrl={
                  typeof window === "undefined" ? "" : bookingReturnUrl()
                }
                billingEmail={email}
                billingName={name}
                submitLabel={t("pay.pay", {
                  price: formatBookingPrice(priceCents, locale),
                })}
                processingLabel={t("pay.processing")}
                failedLabel={t("pay.failed")}
                pendingLabel={t("pay.pendingError")}
                onProcessingChange={setPaymentInFlight}
                onPaid={(result) => {
                  setStep("done")
                  if (result.status === "succeeded") {
                    void confirmPaidHold(reservation, {
                      ...payment,
                      paymentIntentId: result.paymentIntentId,
                    })
                    return
                  }
                  setConfirmState("pending")
                }}
              />
            )}
          </div>
        ) : null}

        {step === "done" && slot && selectedMode ? (
          <div className="mt-8 space-y-6">
            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                {confirmState === "confirmed"
                  ? t("done.heading")
                  : t("done.pending")}
              </h1>
              <p className="text-muted-foreground">
                {confirmState === "confirmed"
                  ? t("done.sub")
                  : t("done.pendingSub")}
              </p>
            </header>
            {confirmState === "failed" && formError ? (
              <div className="space-y-3">
                <FieldError>{t(`errors.${formError}`)}</FieldError>
                {reservation && payment ? (
                  <Button
                    onPress={() => void confirmPaidHold(reservation, payment)}
                  >
                    {t("done.retry")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <p>
              {selectedMode.mode === "phone"
                ? t("done.phone", {
                    phone: maskPhone(toE164(phone, country) ?? phone),
                  })
                : selectedMode.mode === "in_person" && selectedMode.location
                  ? t("done.inPerson", {
                      location: `${selectedMode.location.name}, ${selectedMode.location.city}`,
                    })
                  : t("done.video")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onPress={() =>
                  downloadBookingIcs({
                    uid:
                      payment?.bookingId ??
                      reservation?.reservationId ??
                      eventSlug,
                    summary: `${offerTitle} · ${expertName}`,
                    description:
                      selectedMode.mode === "online"
                        ? t("done.video")
                        : selectedMode.mode === "phone"
                          ? t("done.phone", {
                              phone: maskPhone(toE164(phone, country) ?? phone),
                            })
                          : t("done.inPerson", {
                              location: locationCopy ?? "",
                            }),
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
              >
                {t("done.ics")}
              </Button>
              <LinkButton href="/signup">{t("done.activate")}</LinkButton>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("done.activateHint")}
            </p>
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
          reservation && !holdExpired
            ? t("pay.hold", {
                time: formatCountdown(
                  Math.max(0, new Date(reservation.expiresAt).getTime() - nowMs)
                ),
              })
            : undefined
        }
      />
    </div>
  )
}
