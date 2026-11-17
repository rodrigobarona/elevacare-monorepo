"use client"

import type { ReactNode, Ref } from "react"
import { useTranslations } from "next-intl"
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { UrgentHelp } from "@eleva/dashboard/urgent-help"
import { FieldError } from "@eleva/ui/components/field"
import { InfoPopover } from "@eleva/ui/components/info-popover"
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
  accessInCard,
  email,
  steps,
  changeLines,
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
  /** Phone and in-person sessions say how and where in the summary card. */
  accessInCard: boolean
  email: string
  steps: DoneStep[]
  /** Every dated cancellation line, or the free-session courtesy line. */
  changeLines: string[]
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
      <header className="space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isConfirmed && isRequest ? (
            <ClockIcon aria-hidden className="size-9" weight="fill" />
          ) : (
            <CheckCircleIcon aria-hidden className="size-9" weight="fill" />
          )}
        </div>
        {/* Only the heading and the line under it announce state changes. */}
        <div aria-live="polite" className="space-y-4">
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
                {/* Keep the time range together when the line wraps. */}
                {whenLong.replace(/\s*–\s*/g, "\u2060–\u2060")}{" "}
                <span className="whitespace-nowrap text-muted-foreground">
                  · {zoneLabel}
                </span>
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
        </div>
        {isConfirmed && !isRequest ? (
          <div className="flex justify-center pt-2">
            {/* The pill stays centred; the (i) hangs beside it. */}
            <div className="relative">
              <DropdownMenuTrigger>
                <Button size="lg" className="min-h-12 rounded-full px-6">
                  <CalendarPlusIcon aria-hidden data-icon="inline-start" />
                  {t("done.ics")}
                </Button>
                <DropdownMenu placement="bottom" className="min-w-60">
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
                        <ArrowSquareOutIcon
                          aria-hidden
                          className="ml-auto size-3.5"
                        />
                        <span className="sr-only"> ({t("chrome.newTab")})</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        id="outlook"
                        textValue="Outlook.com"
                        href={calendar.outlook}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Outlook.com
                        <ArrowSquareOutIcon
                          aria-hidden
                          className="ml-auto size-3.5"
                        />
                        <span className="sr-only"> ({t("chrome.newTab")})</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        id="office365"
                        textValue="Microsoft 365"
                        href={calendar.office365}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Microsoft 365
                        <ArrowSquareOutIcon
                          aria-hidden
                          className="ml-auto size-3.5"
                        />
                        <span className="sr-only"> ({t("chrome.newTab")})</span>
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
              {/* What a calendar receives is background, not a step. */}
              <InfoPopover
                label={t("done.calendarNoteLabel")}
                className="absolute top-1/2 left-full my-0 ml-1 size-11 -translate-y-1/2 sm:size-8"
              >
                <p>{t("done.calendarNote")}</p>
              </InfoPopover>
            </div>
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
          {/* "What happens next" already says when the video link opens;
              phone and in-person sessions say here how and where. */}
          {confirmState === "confirmed" && accessInCard ? (
            <p className="mt-5 rounded-2xl bg-muted px-4 py-3 text-sm">
              {accessLine}
            </p>
          ) : null}
        </article>

        {steps.length > 0 || isConfirmed ? (
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
                {isRequest ? (
                  <p className="text-muted-foreground">
                    {t("done.requestChange", { name: expertFirstName })}
                  </p>
                ) : (
                  <>
                    {changeLines.map((line) => (
                      <p key={line} className="text-muted-foreground">
                        {line}
                      </p>
                    ))}
                    <p className="text-muted-foreground">
                      {t("done.changeHow")}
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* A request joins her Space only once accepted. */}
      {isConfirmed && !isRequest ? (
        <section
          aria-labelledby="booking-space-invite"
          className="mt-6 grid gap-6 rounded-4xl bg-card p-6 shadow-1 ring-1 ring-foreground/5 md:grid-cols-[1fr_auto] md:items-center md:p-8"
          data-testid="booking-space-invite"
        >
          <div className="space-y-2">
            <h2
              id="booking-space-invite"
              className="font-display text-2xl font-medium"
            >
              {t("done.space.heading")}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("done.space.line")}
            </p>
          </div>
          <LinkButton
            href={signupHref}
            size="lg"
            variant="outline"
            className="min-h-12 rounded-full px-6"
          >
            {t("done.space.cta")}
          </LinkButton>
        </section>
      ) : null}

      <UrgentHelp className="mt-6 rounded-3xl p-5" />
    </div>
  )
}
