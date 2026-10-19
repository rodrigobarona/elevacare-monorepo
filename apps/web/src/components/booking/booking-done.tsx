"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import {
  CalendarCheckIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  ShieldIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { FieldError } from "@eleva/ui/components/field"

type ConfirmState = "idle" | "pending" | "confirmed" | "failed"

export function BookingDone({
  confirmState,
  isRequest,
  errorMessage,
  onRetry,
  expertName,
  offerTitle,
  media,
  whenLabel,
  modeLabel,
  priceLabel,
  accessNote,
  policyName,
  isOnline,
  signupHref,
  onAddToCalendar,
}: {
  confirmState: ConfirmState
  isRequest: boolean
  errorMessage: string | null
  onRetry?: () => void
  expertName: string
  offerTitle: string
  media: ReactNode
  whenLabel: string
  modeLabel: string
  priceLabel: string
  accessNote: string
  policyName: string
  isOnline: boolean
  signupHref: string
  onAddToCalendar: () => void
}) {
  const t = useTranslations("booking")
  const isConfirmed = confirmState === "confirmed"

  const heading = isConfirmed
    ? isRequest
      ? t("done.requestHeading")
      : t("done.heading")
    : t("done.pending")
  const sub = isConfirmed
    ? isRequest
      ? t("done.requestSub")
      : t("done.sub")
    : t("done.pendingSub")

  return (
    <div className="mx-auto max-w-4xl">
      <header className="space-y-4 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircleIcon className="size-9" weight="fill" />
        </div>
        <h1
          className="font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl"
          data-testid="booking-done-heading"
          data-state={confirmState}
        >
          {heading}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-pretty text-muted-foreground">
          {sub}
        </p>
      </header>

      {confirmState === "failed" && errorMessage ? (
        <div className="mx-auto mt-8 max-w-xl space-y-3 text-center">
          <FieldError>{errorMessage}</FieldError>
          {onRetry ? (
            <Button onPress={onRetry}>{t("done.retry")}</Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <article className="rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5">
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
              <dd className="text-right font-medium">{whenLabel}</dd>
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
          <p className="mt-5 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {accessNote}
          </p>
        </article>

        <section className="rounded-4xl bg-muted/60 p-6">
          <h2 className="font-display text-xl font-medium">
            {t("done.nextHeading")}
          </h2>
          <ol className="mt-5 space-y-4 text-sm">
            <NextStep icon={<EnvelopeIcon className="size-4" />}>
              {t("done.next.email")}
            </NextStep>
            <NextStep icon={<CalendarCheckIcon className="size-4" />}>
              {isRequest
                ? t("done.requestNoJoin")
                : isOnline
                  ? t("done.next.joinOnline")
                  : accessNote}
            </NextStep>
            <NextStep icon={<ShieldIcon className="size-4" />}>
              {t("done.next.policy", { policy: policyName })}
            </NextStep>
          </ol>

          {isConfirmed ? (
            <div className="mt-6 space-y-3 border-t border-border pt-6">
              <div className="flex flex-wrap gap-3">
                {!isRequest ? (
                  <Button variant="outline" onPress={onAddToCalendar}>
                    {t("done.ics")}
                  </Button>
                ) : null}
                <LinkButton href={signupHref}>{t("done.activate")}</LinkButton>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("done.activateHint")}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function NextStep({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-1">
        {icon}
      </span>
      <span className="pt-1 text-pretty">{children}</span>
    </li>
  )
}
