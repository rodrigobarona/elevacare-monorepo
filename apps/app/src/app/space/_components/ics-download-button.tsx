"use client"

import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import { CalendarCheckIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import type { ListMeBookingsResponse } from "@eleva/api-client"
import { downloadBookingIcs } from "@eleva/calendar/ics-download"
import { eventTitle } from "@/lib/member-format"
import { isSessionMode } from "@/lib/booking-status"

type MemberBooking = ListMeBookingsResponse["bookings"][number]

/** "Add to calendar": downloads the session as a calendar file. */
export function IcsDownloadButton({
  booking,
  memberName,
  memberEmail,
}: {
  booking: MemberBooking
  memberName: string
  memberEmail: string
}) {
  const t = useTranslations("sessions")
  const locale = useLocale()
  const title = eventTitle(booking.eventType.title, locale)

  return (
    <Button
      variant="outline"
      onPress={() => {
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
      }}
    >
      <CalendarCheckIcon className="size-4" />
      {t("addToCalendar")}
    </Button>
  )
}
