"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { intlLocale } from "@eleva/config/i18n"
import { pickLocalized } from "@eleva/config/i18n-locales"
import { LinkButton } from "@eleva/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@eleva/ui/components/sheet"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { useIsMobile } from "@eleva/ui/hooks/use-mobile"
import { JoinCta } from "@eleva/video/join-cta"
import { CancelSession } from "./cancel-session"
import { RequestActions } from "./request-actions"
import { sessionKind, type CalendarBooking } from "./week-data"

/**
 * One session's details and what the expert can do with it. Opens from a
 * block in the week grid or a row in the list: beside the calendar on a
 * wide screen, from the bottom on a phone.
 */
export function BookingSheet({
  booking,
  isOpen,
  onOpenChange,
  orgSlug,
  modeName,
  onSettled,
  onChanged,
  now,
}: {
  /** The session selected; the caller keeps it while the sheet closes. */
  booking: CalendarBooking | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  orgSlug: string
  modeName: (mode: CalendarBooking["sessionMode"]) => string
  onSettled: (bookingId: string, status: "confirmed" | "cancelled") => void
  /** The session is no longer as shown: close and load the week again. */
  onChanged: () => void
  /** The page's clock; `null` until the browser has set it. */
  now: Date | null
}) {
  const t = useTranslations("calendar")
  const tReport = useTranslations("sessions.report")
  const locale = useLocale()
  const isMobile = useIsMobile()
  const { dayFormatter, timeFormatter, deadlineFormatter } = React.useMemo(
    () => ({
      dayFormatter: new Intl.DateTimeFormat(intlLocale(locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      timeFormatter: new Intl.DateTimeFormat(intlLocale(locale), {
        timeStyle: "short",
      }),
      deadlineFormatter: new Intl.DateTimeFormat(intlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    }),
    [locale]
  )

  if (!booking) return null
  const kind = sessionKind(booking.status)
  const isRequest = kind === "request"
  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  // A confirmed session can be cancelled by the expert until it starts.
  const canCancel =
    (booking.status === "confirmed" || booking.status === "rescheduled") &&
    now !== null &&
    start > now
  // Online and phone sessions already say so under "Mode".
  const where = booking.locationName
    ? [booking.locationName, booking.locationCity, booking.locationCountry]
        .filter(Boolean)
        .join(", ")
    : null

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      side={isMobile ? "bottom" : "right"}
      showCloseButton={false}
      className={
        isMobile
          ? "max-h-[88dvh] overflow-y-auto rounded-t-3xl"
          : "overflow-y-auto"
      }
    >
      <SheetHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {kind !== "session" ? (
              <StatusPill tone="attention">
                {isRequest ? t("requestPending") : t("awaitingPayment")}
              </StatusPill>
            ) : null}
            <SheetTitle className="font-display text-xl tracking-tight text-balance">
              {pickLocalized(booking.eventTypeTitle, locale)}
            </SheetTitle>
          </div>
          <SheetClose variant="ghost" className="-mt-1.5 -mr-2">
            {t("closeDrawer")}
          </SheetClose>
        </div>
        <SheetDescription className="text-base text-foreground">
          <span className="block first-letter:uppercase">
            {dayFormatter.format(start)}
          </span>
          <span className="block text-muted-foreground tabular-nums">
            {timeFormatter.format(start)}–{timeFormatter.format(end)}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <dl className="grid gap-3 rounded-2xl bg-sand-50 p-4 sm:grid-cols-2 dark:bg-foreground/5">
          <div>
            <dt className="text-xs text-muted-foreground">{t("member")}</dt>
            <dd>{booking.memberFirstName ?? t("memberUnknown")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("mode")}</dt>
            <dd>
              {booking.modeLabel
                ? pickLocalized(booking.modeLabel, locale)
                : modeName(booking.sessionMode)}
            </dd>
          </div>
          {isRequest && booking.approvalDeadlineAt ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("respondBy")}
              </dt>
              <dd>
                {deadlineFormatter.format(new Date(booking.approvalDeadlineAt))}
              </dd>
            </div>
          ) : null}
          {where ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("location")}</dt>
              <dd>{where}</dd>
            </div>
          ) : null}
        </dl>

        {kind === "unpaid" ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {t("awaitingPaymentHint")}
          </p>
        ) : null}
        {isRequest ? (
          <RequestActions
            // A fresh dialog per request: a reason chosen for one is never
            // carried to another.
            key={booking.id}
            bookingId={booking.id}
            memberName={booking.memberFirstName}
            onSettled={(status) => onSettled(booking.id, status)}
          />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <JoinCta
              className="mt-0"
              href={`/${orgSlug}/team/sessions/${booking.id}/join`}
              sessionMode={booking.sessionMode}
              status={booking.status}
              startsAt={booking.startsAt}
              endsAt={booking.endsAt}
              joinLabel={t("join")}
              joinSoonLabel={t("joinSoon")}
              pending="hint"
            />
            {booking.status === "confirmed" ||
            booking.status === "rescheduled" ||
            booking.status === "completed" ? (
              <LinkButton
                variant="outline"
                href={`/${orgSlug}/team/sessions/${booking.id}/report`}
              >
                {tReport("open")}
              </LinkButton>
            ) : null}
            {canCancel ? (
              <CancelSession
                // A fresh dialog per session: a reason chosen for one is
                // never carried to another.
                key={booking.id}
                bookingId={booking.id}
                startsAt={booking.startsAt}
                sessionSummary={`${pickLocalized(booking.eventTypeTitle, locale)} · ${dayFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(end)}`}
                memberName={booking.memberFirstName ?? t("memberUnknown")}
                onCancelled={() => onSettled(booking.id, "cancelled")}
                onChanged={onChanged}
              />
            ) : null}
          </div>
        )}
      </div>
    </Sheet>
  )
}
