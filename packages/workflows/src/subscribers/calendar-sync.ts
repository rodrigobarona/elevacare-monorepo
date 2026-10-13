import { eq } from "drizzle-orm"
import { main } from "@eleva/db"
import { withOrgContext, type Tx } from "@eleva/db/context"
import {
  isBookingNotificationKind,
  parseBookingNotificationPayload,
} from "@eleva/notifications"
import type { DomainEventSubscriber } from "../domain-events"
import {
  calendarEventCreate,
  calendarEventDelete,
  calendarEventUpdate,
} from "../scheduling/calendar-event-sync"

const ACTIVE_STATUSES = new Set(["confirmed", "rescheduled"])

async function loadBookingSession(orgId: string, bookingId: string) {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        sessionId: main.sessions.id,
        startsAt: main.sessions.startsAt,
        endsAt: main.sessions.endsAt,
        calendarEventId: main.sessions.calendarEventId,
        bookingStatus: main.bookings.status,
      })
      .from(main.sessions)
      .innerJoin(main.bookings, eq(main.sessions.bookingId, main.bookings.id))
      .where(eq(main.sessions.bookingId, bookingId))
      .limit(1)
    return row
  })
}

/**
 * Mirrors booking lifecycle events into the expert's connected calendar.
 * Acts on the booking's current state, so a late or retried event cannot
 * recreate a cancelled booking or move an event to stale times.
 */
export const handleCalendarSync: DomainEventSubscriber = async (event) => {
  if (!isBookingNotificationKind(event.type)) return
  const { bookingId } = parseBookingNotificationPayload(
    event.type,
    event.payload
  )
  const session = await loadBookingSession(event.orgId, bookingId)
  if (!session) return
  const active = ACTIVE_STATUSES.has(session.bookingStatus)
  const ids = { sessionId: session.sessionId, orgId: event.orgId }

  switch (event.type) {
    case "booking.confirmed":
      if (active && !session.calendarEventId) {
        await calendarEventCreate({ ...ids, bookingId })
      }
      return
    case "booking.rescheduled":
      if (!active) return
      if (session.calendarEventId) {
        await calendarEventUpdate({
          ...ids,
          newStartTime: session.startsAt,
          newEndTime: session.endsAt,
        })
      } else {
        await calendarEventCreate({ ...ids, bookingId })
      }
      return
    case "booking.cancelled":
      if (!active) await calendarEventDelete(ids)
      return
    default: {
      const _exhaustive: never = event.type
      return _exhaustive
    }
  }
}
