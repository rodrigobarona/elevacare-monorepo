import { shownBookingStatus } from "@eleva/ui/lib/booking/shown-status"
import { JOIN_TRAIL_MS } from "@eleva/video/join-window"

const BOOKING_STATUS_KEYS = [
  "confirmed",
  "rescheduled",
  "cancelled",
  "pending_payment",
  "awaiting_confirmation",
  "completed",
  "no_show",
  // Display only: a confirmed session whose time has passed
  // (`shownBookingStatus`). It is never stored.
  "ended",
] as const

export type BookingStatusKey = (typeof BOOKING_STATUS_KEYS)[number]

export function isBookingStatus(value: string): value is BookingStatusKey {
  return (BOOKING_STATUS_KEYS as readonly string[]).includes(value)
}

export function isAwaitingConfirmation(status: string): boolean {
  return status === "awaiting_confirmation"
}

const MODE_KEYS = ["online", "in_person", "phone"] as const

export type SessionModeKey = (typeof MODE_KEYS)[number]

export function isSessionMode(value: string): value is SessionModeKey {
  return (MODE_KEYS as readonly string[]).includes(value)
}

/**
 * What to show for a member's booking. An online session keeps its stored
 * status until joining closes; the others until their booked end.
 */
export function shownMemberBookingStatus(booking: {
  status: string
  endsAt: string
  sessionMode: string
}): string {
  return shownBookingStatus(booking.status, booking.endsAt, {
    graceMs: booking.sessionMode === "online" ? JOIN_TRAIL_MS : 0,
  })
}
