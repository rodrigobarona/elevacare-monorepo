"use client"

import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import {
  CalendarCheckIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { Badge } from "@eleva/ui/components/badge"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { JoinCta } from "@eleva/video/join-cta"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import type { ListMeBookingsResponse } from "@eleva/api-client"
import { downloadBookingIcs } from "@eleva/calendar/ics-download"
import { eventTitle, formatDateTime, formatMoney } from "@/lib/member-format"
import {
  isAwaitingConfirmation,
  isBookingStatus,
  isSessionMode,
} from "@/lib/booking-status"

type MemberBooking = ListMeBookingsResponse["bookings"][number]

interface BookingCardProps {
  booking: MemberBooking
  orgSlug: string
  memberName: string
  memberEmail: string
  showJoin?: boolean
}

export function BookingCard({
  booking,
  orgSlug,
  memberName,
  memberEmail,
  showJoin = true,
}: BookingCardProps) {
  const t = useTranslations("sessions")
  const locale = useLocale()
  const title = eventTitle(booking.eventType.title, locale)
  const when = formatDateTime(booking.startsAt, locale, booking.timezone)
  const awaiting = isAwaitingConfirmation(booking.status)

  function handleIcs() {
    try {
      downloadBookingIcs({
        uid: booking.id,
        summary: `${title} — ${booking.expert.displayName}`,
        description: isSessionMode(booking.sessionMode)
          ? t(`modes.${booking.sessionMode}`)
          : booking.sessionMode,
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

  return (
    <Card
      size="sm"
      data-testid="member-booking-card"
      data-booking-id={booking.id}
      data-status={booking.status}
      data-expert={booking.expert.username}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {booking.expert.displayName} · {when}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {isBookingStatus(booking.status)
            ? t(`statusLabel.${booking.status}`)
            : booking.status}
        </Badge>
        <Badge variant="outline">
          {isSessionMode(booking.sessionMode)
            ? t(`modes.${booking.sessionMode}`)
            : booking.sessionMode}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatMoney(booking.priceCents, locale, booking.currency)}
        </span>
        {awaiting ? (
          <p className="w-full text-sm text-muted-foreground">
            {t("awaitingConfirmationHint")}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
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
        <Button variant="outline" onPress={handleIcs}>
          <CalendarCheckIcon className="size-4" />
          {t("addToCalendar")}
        </Button>
        <LinkButton
          variant="outline"
          href={`/${orgSlug}/sessions/${booking.id}`}
          data-testid="member-booking-detail"
        >
          {t("detailTitle")}
        </LinkButton>
      </CardFooter>
    </Card>
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
