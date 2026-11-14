"use client"

import type { ReactNode, Ref } from "react"
import { useTranslations } from "next-intl"
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  ArrowsClockwiseIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { UrgentHelp } from "@eleva/dashboard/urgent-help"
import { FieldError } from "@eleva/ui/components/field"
import type { CalendarLinks } from "@eleva/calendar/calendar-links"

type ConfirmState = "idle" | "pending" | "confirmed" | "failed"

export type DoneStep = {
  /** When it happens, e.g. "Now" or "Thu 10 Dec, 16:00". */
  when: string
  text: string
}

/**
 * The thank-you page as an arrival (Headspace, Warby Parker, Cal.com): the
 * expert and the time in the headline, where the confirmation went, the
 * calendar first, dated next steps, how to change or cancel, and the Space
 * invitation in its own band.
 */
export function BookingDone({
  confirmState,
  isRequest,
  errorMessage,
  onRetry,
  expertFirstName,
  expertName,
  offerTitle,
  media,
  whenLong,
  zoneLabel,
  modeLabel,
  priceLabel,
  accessLine,
  email,
  steps,
  changeLine,
  calendar,
  onDownloadIcs,
  signupHref,
  headingRef,
}: {
  confirmState: ConfirmState
  isRequest: boolean
  errorMessage: string | null
  onRetry?: () => void
  expertFirstName: string
  expertName: string
  offerTitle: string
  media: ReactNode
  /** "Friday 11 December, 16:00–17:00". */
  whenLong: string
  /** "Lisbon time". */
  zoneLabel: string
  modeLabel: string
  priceLabel: string
  /** One sentence on how to join or where to go. */
  accessLine: string
  email: string
  steps: DoneStep[]
  /** The dated cancellation line, or the free-session courtesy line. */
  changeLine: string
  calendar: CalendarLinks | null
  onDownloadIcs: () => void
  signupHref: string
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const t = useTranslations("booking")
  const isConfirmed = confirmState === "confirmed"

  const heading = isConfirmed
    ? isRequest
      ? t("done.requestHeading", { name: expertFirstName })
      : t("done.heading", { name: expertFirstName })
    : t("done.pending")
  const sentTo = isRequest
    ? t("done.requestSentTo", { email, name: expertFirstName })
    : t("done.sentTo", { email })

  return (
    <div className="mx-auto max-w-4xl">
      <header aria-live="polite" className="space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isConfirmed && isRequest ? (
            <ClockIcon className="size-9" weight="fill" />
          ) : (
            <CheckCircleIcon className="size-9" weight="fill" />
          )}
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-4xl font-medium tracking-tight text-balance outline-none sm:text-5xl"
          data-testid="booking-done-heading"
          data-state={confirmState}
        >
          {heading}
        </h1>
        {isConfirmed ? (
          <div className="space-y-1">
            <p className="text-lg font-medium text-pretty first-letter:uppercase">
              {whenLong}
              <span className="text-muted-foreground"> · {zoneLabel}</span>
            </p>
            <p
              className="text-pretty text-muted-foreground"
              data-testid="booking-done-sent-to"
            >
              {sentTo}
            </p>
          </div>
        ) : (
          <p className="mx-auto max-w-xl text-lg text-pretty text-muted-foreground">
            {t("done.pendingSub")}
          </p>
        )}
        {isConfirmed && !isRequest ? (
          <div className="flex justify-center pt-2">
            <DropdownMenuTrigger>
              <Button size="lg" className="min-h-12 rounded-full px-6">
                <CalendarPlusIcon data-icon="inline-start" />
                {t("done.ics")}
              </Button>
              <DropdownMenu placement="bottom">
                {calendar ? (
                  <>
                    <DropdownMenuItem
                      id="google"
                      textValue="Google Calendar"
                      href={calendar.google}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      id="outlook"
                      textValue="Outlook.com"
                      href={calendar.outlook}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Outlook.com
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      id="office365"
                      textValue="Microsoft 365"
                      href={calendar.office365}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Microsoft 365
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  id="ics"
                  textValue={t("done.icsApple")}
                  onAction={onDownloadIcs}
                >
                  {t("done.icsApple")}
                </DropdownMenuItem>
              </DropdownMenu>
            </DropdownMenuTrigger>
          </div>
        ) : null}
      </header>

      {confirmState === "failed" && errorMessage ? (
        <div className="mx-auto mt-8 max-w-xl space-y-3 text-center">
          <FieldError>{errorMessage}</FieldError>
          {onRetry ? (
            <Button onPress={onRetry}>{t("done.retry")}</Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-10 grid items-start gap-6 md:grid-cols-2">
        <article className="flex flex-col rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5">
          <div className="flex items-center gap-4">
            <div className="shrink-0">{media}</div>
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">
                {expertName}
              </p>
              <p className="font-display text-xl leading-tight font-medium">
                {offerTitle}
              </p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-border border-t border-border text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{t("summary.when")}</dt>
              <dd className="text-right font-medium">
                <span className="first-letter:uppercase">{whenLong}</span>
                <span className="block font-normal text-muted-foreground">
                  {zoneLabel}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{t("summary.mode")}</dt>
              <dd className="text-right font-medium">{modeLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 pt-3">
              <dt className="text-muted-foreground">{t("summary.price")}</dt>
              <dd className="text-right font-semibold">{priceLabel}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-2xl bg-muted px-4 py-3 text-sm">
            {accessLine}
          </p>
        </article>

        <section className="rounded-4xl bg-muted/60 p-6">
          <h2 className="font-display text-xl font-medium">
            {t("done.nextHeading")}
          </h2>
          <ol className="mt-5 space-y-5 text-sm">
            {steps.map((step, index) => (
              <li key={step.when + index} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-1"
                >
                  {index === 0 ? (
                    <EnvelopeIcon className="size-4" />
                  ) : index === steps.length - 1 ? (
                    <CalendarCheckIcon className="size-4" />
                  ) : (
                    <ClockIcon className="size-4" />
                  )}
                </span>
                <span className="pt-0.5 text-pretty">
                  <span className="block font-medium first-letter:uppercase">
                    {step.when}
                  </span>
                  <span className="text-muted-foreground">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
          {isConfirmed ? (
            <div className="mt-6 space-y-1 border-t border-border pt-5 text-sm">
              <h3 className="flex items-center gap-2 font-medium">
                <ArrowsClockwiseIcon aria-hidden className="size-4" />
                {t("done.changeHeading")}
              </h3>
              <p className="text-muted-foreground">{changeLine}</p>
              <p className="text-muted-foreground">{t("done.changeHow")}</p>
            </div>
          ) : null}
        </section>
      </div>

      {isConfirmed ? (
        <section
          aria-labelledby="booking-space-invite"
          className="mt-6 grid gap-6 rounded-4xl bg-card p-6 shadow-1 ring-1 ring-foreground/5 md:grid-cols-[1fr_auto] md:items-center md:p-8"
          data-testid="booking-space-invite"
        >
          <div className="space-y-3">
            <h2
              id="booking-space-invite"
              className="font-display text-2xl font-medium"
            >
              {t("done.space.heading")}
            </h2>
            <ul className="space-y-2 text-sm">
              {(["manage", "rebook", "reminders"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <CheckIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  {t(`done.space.${key}`)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t("done.space.prefilled")}
            </p>
          </div>
          <div className="space-y-2 md:text-center">
            <LinkButton
              href={signupHref}
              size="lg"
              variant="outline"
              className="min-h-12 rounded-full px-6"
            >
              {t("done.space.cta")}
            </LinkButton>
            <p className="text-sm text-muted-foreground">
              {t("done.space.later")}
            </p>
          </div>
        </section>
      ) : null}

      <UrgentHelp variant="compact" className="mt-6 rounded-3xl p-5" />
    </div>
  )
}
