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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import type { ListMeBookingsResponse } from "@eleva/api-client"
import { downloadBookingIcs } from "@/lib/booking-ics"
import { eventTitle, formatDateTime, formatMoney } from "@/lib/member-format"

type MemberBooking = ListMeBookingsResponse["bookings"][number]

const BOOKING_STATUS_KEYS = [
  "confirmed",
  "rescheduled",
  "cancelled",
  "pending_payment",
  "completed",
  "no_show",
] as const

type BookingStatusKey = (typeof BOOKING_STATUS_KEYS)[number]

function isBookingStatus(value: string): value is BookingStatusKey {
  return (BOOKING_STATUS_KEYS as readonly string[]).includes(value)
}

const MODE_KEYS = ["online", "in_person", "phone"] as const
type ModeKey = (typeof MODE_KEYS)[number]

function isMode(value: string): value is ModeKey {
  return (MODE_KEYS as readonly string[]).includes(value)
}

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

  function handleIcs() {
    try {
      downloadBookingIcs({
        uid: booking.id,
        summary: `${title} — ${booking.expert.displayName}`,
        description: isMode(booking.sessionMode)
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
          {isMode(booking.sessionMode)
            ? t(`modes.${booking.sessionMode}`)
            : booking.sessionMode}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatMoney(booking.priceCents, locale, booking.currency)}
        </span>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {showJoin ? (
          <Button isDisabled aria-label={t("joinSoon")}>
            <VideoCameraIcon className="size-4" />
            {t("join")}
          </Button>
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
