import type { BookingRuleCheck, BookingRuleError } from "./types"

/**
 * Validate whether a slot can be booked given the event type's booking
 * rules. Returns null on success or a machine-readable error code.
 */
export function validateBookingRules(
  input: BookingRuleCheck
): BookingRuleError | null {
  const { eventType, slotStart, now = new Date() } = input

  if (slotStart.getTime() <= now.getTime()) {
    return "past_slot"
  }

  const msUntilSlot = slotStart.getTime() - now.getTime()
  const minutesUntilSlot = msUntilSlot / 60_000

  if (minutesUntilSlot < eventType.minimumNoticeMinutes) {
    return "insufficient_notice"
  }

  if (eventType.bookingWindowDays != null) {
    const maxMs = eventType.bookingWindowDays * 24 * 3_600_000
    if (msUntilSlot > maxMs) {
      return "outside_booking_window"
    }
  }

  return null
}

/**
 * Check whether a booking can still be cancelled given the event
 * type's cancellation window.
 */
export function canCancel(
  cancellationWindowHours: number | null,
  startsAt: Date,
  now: Date = new Date()
): boolean {
  if (cancellationWindowHours == null) return true
  const hoursUntil = (startsAt.getTime() - now.getTime()) / 3_600_000
  return hoursUntil >= cancellationWindowHours
}

/**
 * Check whether a booking can still be rescheduled given the event
 * type's reschedule window.
 */
export function canReschedule(
  rescheduleWindowHours: number | null,
  startsAt: Date,
  now: Date = new Date()
): boolean {
  if (rescheduleWindowHours == null) return true
  const hoursUntil = (startsAt.getTime() - now.getTime()) / 3_600_000
  return hoursUntil >= rescheduleWindowHours
}
