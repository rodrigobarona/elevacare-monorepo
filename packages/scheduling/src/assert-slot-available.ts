import { validateBookingRules } from "./booking-rules"
import { getAvailableSlotsForOffer } from "./offer-slots"
import type { ResolvedOffer } from "./resolve-offer"
import type { BusyInterval, GetAvailableSlotsInput } from "./types"

export type AssertSlotAvailableInput = {
  offer: ResolvedOffer
  startsAt: Date
  endsAt: Date
  schedule: { timezone: string }
  rules: GetAvailableSlotsInput["rules"]
  overrides: GetAvailableSlotsInput["overrides"]
  existingBookings: BusyInterval[]
  now?: Date
}

/**
 * Same grid as GET /public/.../slots: duration, booking rules, weekly
 * windows, overrides, and busy intervals. Call before the Redis hold.
 */
export function assertRequestedSlotAvailable(
  input: AssertSlotAvailableInput
): { ok: true } | { ok: false; error: "SLOT_UNAVAILABLE" } {
  const durationMs = input.offer.durationMinutes * 60_000
  if (input.endsAt.getTime() - input.startsAt.getTime() !== durationMs) {
    return { ok: false, error: "SLOT_UNAVAILABLE" }
  }

  const ruleError = validateBookingRules({
    eventType: {
      bookingWindowDays: input.offer.bookingWindowDays,
      minimumNoticeMinutes: input.offer.minimumNoticeMinutes,
      cancellationWindowHours: null,
      rescheduleWindowHours: null,
    },
    slotStart: input.startsAt,
    now: input.now,
  })
  if (ruleError !== null) {
    return { ok: false, error: "SLOT_UNAVAILABLE" }
  }

  const slots = getAvailableSlotsForOffer({
    offer: input.offer,
    schedule: input.schedule,
    rules: input.rules,
    overrides: input.overrides,
    existingBookings: input.existingBookings,
    from: input.startsAt,
    to: input.endsAt,
    bookingWindowDays: input.offer.bookingWindowDays,
    minimumNoticeMinutes: input.offer.minimumNoticeMinutes,
    bufferBeforeMinutes: input.offer.bufferBeforeMinutes,
    bufferAfterMinutes: input.offer.bufferAfterMinutes,
  })

  const matched = slots.some(
    (slot) =>
      slot.start.getTime() === input.startsAt.getTime() &&
      slot.end.getTime() === input.endsAt.getTime()
  )
  return matched ? { ok: true } : { ok: false, error: "SLOT_UNAVAILABLE" }
}
