"use client"

import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import {
  ArrowsClockwiseIcon,
  CalendarCheckIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Eyebrow } from "@eleva/ui/components/typography"
import { cn } from "@eleva/ui/lib/utils"
import { JoinCta } from "@eleva/video/join-cta"
import type { ListMeBookingsResponse } from "@eleva/api-client"
import { downloadBookingIcs } from "@eleva/calendar/ics-download"
import { expertProfileUrl } from "@/lib/experts-url"
import { eventTitle, formatMoney } from "@/lib/member-format"
import {
  isAwaitingConfirmation,
  isBookingStatus,
  isSessionMode,
} from "@/lib/booking-status"
import { bookingDateParts, DateTile, StatusPill } from "./booking-visuals"

type MemberBooking = ListMeBookingsResponse["bookings"][number]

interface BookingCardProps {
  booking: MemberBooking
  orgSlug: string
  memberName: string
  memberEmail: string
  /** Upcoming sessions show Join and Add to calendar; past ones show Book again. */
  showJoin?: boolean
  /** Larger card for the member's next session on Space home. */
  featured?: boolean
}

export function BookingCard({
  booking,
  orgSlug,
  memberName,
  memberEmail,
  showJoin = true,
  featured = false,
}: BookingCardProps) {
  const t = useTranslations("sessions")
  const locale = useLocale()
  const title = eventTitle(booking.eventType.title, locale)
  const parts = bookingDateParts(
    booking.startsAt,
    booking.endsAt,
    locale,
    booking.timezone
  )
  const awaiting = isAwaitingConfirmation(booking.status)
  const status = isBookingStatus(booking.status) ? booking.status : null
  const modeLabel = isSessionMode(booking.sessionMode)
    ? t(`modes.${booking.sessionMode}`)
    : booking.sessionMode

  function handleIcs() {
    try {
      downloadBookingIcs({
        uid: booking.id,
        summary: `${title} — ${booking.expert.displayName}`,
        description: modeLabel,
        start: booking.startsAt,
        end: booking.endsAt,
        timeZone: booking.timezone,
        expertName: booking.expert.displayName,
        memberName,
        memberEmail,
      })
    } catch {
      toast.error(t("icsFailed"))
    }
  }

  const actions = (
    <>
      {showJoin && !awaiting ? (
        <JoinCta
          href={`/${orgSlug}/sessions/${booking.id}/join`}
          sessionMode={booking.sessionMode}
          status={booking.status}
          startsAt={booking.startsAt}
          endsAt={booking.endsAt}
          joinLabel={t("join")}
          joinSoonLabel={t("joinSoon")}
          icon={<VideoCameraIcon className="size-4" />}
        />
      ) : null}
      {showJoin ? (
        <Button variant="outline" onPress={handleIcs}>
          <CalendarCheckIcon className="size-4" />
          {t("addToCalendar")}
        </Button>
      ) : (
        <LinkButton
          variant="outline"
          href={expertProfileUrl(locale, booking.expert.username)}
        >
          <ArrowsClockwiseIcon className="size-4" />
          {t("bookAgain")}
        </LinkButton>
      )}
      <LinkButton
        variant={featured ? "ghost" : "outline"}
        href={`/${orgSlug}/sessions/${booking.id}`}
        data-testid="member-booking-detail"
      >
        {t("detailTitle")}
      </LinkButton>
    </>
  )

  return (
    <article
      data-testid="member-booking-card"
      data-booking-id={booking.id}
      data-status={booking.status}
      data-expert={booking.expert.username}
      className={cn(
        "overflow-hidden border bg-card text-card-foreground",
        featured ? "rounded-3xl shadow-2" : "rounded-2xl shadow-1"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center",
          featured ? "p-6 sm:gap-6 sm:p-8" : "p-4 sm:gap-5 sm:p-5"
        )}
      >
        <DateTile
          month={parts.month}
          day={parts.day}
          weekday={parts.weekday}
          large={featured}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          {featured ? <Eyebrow>{t("nextTitle")}</Eyebrow> : null}
          <h3
            className={cn(
              "font-display leading-snug font-medium tracking-tight",
              featured ? "text-2xl" : "text-lg"
            )}
          >
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {booking.expert.displayName}
            <span aria-hidden> · </span>
            {featured ? (
              <span className="first-letter:uppercase">{parts.longDate}</span>
            ) : (
              <>
                <span className="sr-only">{parts.longDate}</span>
                <span aria-hidden className="first-letter:uppercase">
                  {parts.weekday}
                </span>
              </>
            )}
            {", "}
            {parts.time}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            <StatusPill status={status}>
              {status ? t(`statusLabel.${status}`) : booking.status}
            </StatusPill>
            <span className="rounded-full border px-2.5 py-0.5 text-xs">
              {modeLabel}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatMoney(booking.priceCents, locale, booking.currency)}
            </span>
          </div>
          {awaiting ? (
            <p className="pt-1 text-sm text-muted-foreground">
              {t("awaitingConfirmationHint")}
            </p>
          ) : null}
        </div>
        {featured ? null : (
          <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
      {featured ? (
        <div className="flex flex-wrap gap-2 border-t bg-sand-50/70 px-6 py-4 sm:px-8 dark:bg-muted/40">
          {actions}
        </div>
      ) : null}
    </article>
  )
}

export function FindExpertButton({ href }: { href: string }) {
  const t = useTranslations("home")
  return (
    <LinkButton href={href}>
      <MagnifyingGlassIcon className="size-4" />
      {t("findExpert")}
    </LinkButton>
  )
}
