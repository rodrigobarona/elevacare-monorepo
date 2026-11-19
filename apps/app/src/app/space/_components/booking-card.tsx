"use client"

import { useId } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import {
  ArrowsClockwiseIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import {
  JoinCta,
  JoinPendingHint,
  useJoinCtaClock,
} from "@eleva/video/join-cta"
import { isJoinCtaEnabled, isJoinableStatus } from "@eleva/video/join-window"
import type { ListMeBookingsResponse } from "@eleva/api-client"
import { expertProfileUrl } from "@eleva/config/env"
import { eventTitle, joinOpensTime } from "@/lib/member-format"
import {
  isAwaitingConfirmation,
  isBookingStatus,
  isSessionMode,
  shownMemberBookingStatus,
} from "@/lib/booking-status"
import { DateTile } from "@eleva/ui/components/date-tile"
import { bookingDateParts } from "@eleva/ui/lib/booking/date-parts"
import { StatusPill } from "./booking-visuals"
import { IcsDownloadButton } from "./ics-download-button"
import { MetaLine } from "./meta-line"
import { SPACE_BASE } from "@eleva/config/routing"

type MemberBooking = ListMeBookingsResponse["bookings"][number]

interface BookingCardProps {
  booking: MemberBooking
  memberName: string
  memberEmail: string
  /** A session from the past list: it offers Book again. */
  past?: boolean
  /** Larger card for the member's next session on Space home. */
  featured?: boolean
}

/**
 * One session in a list. The card opens the session; it carries one action
 * of its own only when there is one to take now (Join while joining is
 * open, Book again once it is over). The next session on Space home is the
 * larger card, with Join and Add to calendar under it.
 */
export function BookingCard({
  booking,
  memberName,
  memberEmail,
  past = false,
  featured = false,
}: BookingCardProps) {
  const t = useTranslations("sessions")
  const locale = useLocale()
  const metaId = useId()
  const joinHintId = useId()
  const now = useJoinCtaClock()
  const title = eventTitle(booking.eventType.title, locale)
  const parts = bookingDateParts(
    booking.startsAt,
    booking.endsAt,
    locale,
    booking.timezone
  )
  const awaiting = isAwaitingConfirmation(booking.status)
  // A confirmed session that is over reads "Ended", not "Confirmed".
  const shown = shownMemberBookingStatus(booking)
  const status = isBookingStatus(shown) ? shown : null
  const modeLabel = isSessionMode(booking.sessionMode)
    ? t(`modes.${booking.sessionMode}`)
    : booking.sessionMode
  const detailHref = `${SPACE_BASE}/sessions/${booking.id}`
  const canJoin =
    booking.sessionMode === "online" && isJoinableStatus(booking.status)
  // Joining is open right now. A session that has just started sits in
  // the past list and can still be joined.
  const joinOpen =
    canJoin &&
    now !== null &&
    isJoinCtaEnabled({
      sessionMode: booking.sessionMode,
      status: booking.status,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      now,
    })
  const joinOpens = t("joinOpens", {
    time: joinOpensTime(booking.startsAt, locale, booking.timezone),
  })

  const join = (pending: "button" | "none") => (
    <JoinCta
      href={`${detailHref}/join`}
      sessionMode={booking.sessionMode}
      status={booking.status}
      startsAt={booking.startsAt}
      endsAt={booking.endsAt}
      joinLabel={t("join")}
      joinSoonLabel={joinOpens}
      describedBy={pending === "button" ? joinHintId : undefined}
      icon={<VideoCameraIcon className="size-4" />}
      pending={pending}
      className="relative z-10"
    />
  )

  // One action on a list card: Join while it is open, or Book again for a
  // session that is over. On a phone it sits under the text. Until the
  // time is known, a session that might still be joinable shows neither.
  const listAction = joinOpen ? (
    join("none")
  ) : past && !(canJoin && now === null) ? (
    <LinkButton
      variant="outline"
      href={expertProfileUrl(locale, booking.expert.username)}
      className="relative z-10"
    >
      <ArrowsClockwiseIcon className="size-4" />
      {t("bookAgain")}
    </LinkButton>
  ) : null

  return (
    <article
      data-testid="member-booking-card"
      data-booking-id={booking.id}
      data-status={booking.status}
      data-expert={booking.expert.username}
      className={cn(
        "relative overflow-hidden border bg-card text-card-foreground",
        featured
          ? "rounded-3xl shadow-2"
          : "rounded-2xl shadow-1 transition-shadow hover:shadow-2"
      )}
    >
      <div
        className={cn(
          "flex",
          featured
            ? "flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8"
            : "flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap sm:gap-x-5 sm:p-5"
        )}
      >
        <DateTile
          month={parts.month}
          day={parts.day}
          weekday={parts.weekday}
          large={featured}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3
            className={cn(
              "font-display leading-snug font-medium tracking-tight",
              featured ? "text-2xl" : "text-lg"
            )}
          >
            <Link
              href={detailHref}
              data-testid="member-booking-detail"
              aria-describedby={metaId}
              className={cn(
                "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // The whole card opens the session; its own action sits
                // above this link.
                featured ? "hover:underline" : "after:absolute after:inset-0"
              )}
            >
              {title}
            </Link>
          </h3>
          <MetaLine
            id={metaId}
            className="text-sm text-muted-foreground"
            items={[
              booking.expert.displayName,
              <>
                {featured ? (
                  <span className="inline-block first-letter:uppercase">
                    {parts.longDate}
                  </span>
                ) : (
                  <>
                    <span className="sr-only">{parts.longDate}</span>
                    <span
                      aria-hidden
                      className="inline-block first-letter:uppercase"
                    >
                      {parts.weekday}
                    </span>
                  </>
                )}
                {", "}
                {parts.time}
              </>,
              modeLabel,
            ]}
          />
          <div className="pt-1">
            <StatusPill status={status}>
              {status ? t(`statusLabel.${status}`) : shown}
            </StatusPill>
          </div>
          {awaiting ? (
            <p className="pt-1 text-sm text-muted-foreground">
              {t("awaitingConfirmationHint")}
            </p>
          ) : null}
        </div>
        {featured ? null : (
          <>
            {listAction ? (
              // Under the text on a phone, in line with it from `sm`.
              <div className="order-last basis-full pl-20 sm:order-none sm:basis-auto sm:pl-0">
                {listAction}
              </div>
            ) : null}
            <CaretRightIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          </>
        )}
      </div>
      {featured ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-sand-50/70 px-6 py-4 sm:px-8 dark:bg-muted/40">
          {canJoin ? join("button") : null}
          <IcsDownloadButton
            booking={booking}
            memberName={memberName}
            memberEmail={memberEmail}
          />
          {canJoin ? (
            <JoinPendingHint
              id={joinHintId}
              sessionMode={booking.sessionMode}
              status={booking.status}
              startsAt={booking.startsAt}
              className="text-sm text-muted-foreground"
            >
              {joinOpens}
            </JoinPendingHint>
          ) : null}
          <LinkButton
            variant="ghost"
            href={detailHref}
            className="-ml-3 sm:ml-auto"
          >
            {t("detailTitle")}
          </LinkButton>
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
