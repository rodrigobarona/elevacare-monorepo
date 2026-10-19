const BOOKING_STATUS_KEYS = [
  "confirmed",
  "rescheduled",
  "cancelled",
  "pending_payment",
  "awaiting_confirmation",
  "completed",
  "no_show",
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
