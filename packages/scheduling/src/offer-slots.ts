import { getAvailableSlots } from "./availability"
import type { ResolvedOffer } from "./resolve-offer"
import { formatDateInTimezone, getDateParts } from "./timezone"
import type { BusyInterval, GetAvailableSlotsInput, TimeSlot } from "./types"

export const DEFAULT_BUFFER_BEFORE_MINUTES = 10
export const DEFAULT_MINIMUM_NOTICE_MINUTES = 24 * 60
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30
export const DEFAULT_BOOKING_WINDOW_DAYS = 60

export interface BusyTimeProvider {
  getBusy(input: {
    expertUserId: string
    from: Date
    to: Date
  }): Promise<BusyInterval[]>
}

export const emptyBusyTimeProvider: BusyTimeProvider = {
  async getBusy() {
    return []
  },
}

export type GetOfferSlotsInput = {
  offer: ResolvedOffer
  schedule: { timezone: string }
  rules: GetAvailableSlotsInput["rules"]
  overrides: GetAvailableSlotsInput["overrides"]
  existingBookings: BusyInterval[]
  externalBusyTimes?: BusyInterval[]
  from: Date
  to: Date
  viewerTz?: string
  bookingWindowDays?: number | null
  minimumNoticeMinutes?: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  slotIntervalMinutes?: number
}

export type ViewerTimeSlot = TimeSlot & {
  startLocal: string
  endLocal: string
}

export function formatInstantInTimezone(date: Date, timezone: string): string {
  const p = getDateParts(date, timezone)
  const hh = String(p.hour).padStart(2, "0")
  const mm = String(p.minute).padStart(2, "0")
  const ss = String(p.second).padStart(2, "0")
  return `${formatDateInTimezone(date, timezone)}T${hh}:${mm}:${ss}`
}

export function getAvailableSlotsForOffer(
  input: GetOfferSlotsInput
): ViewerTimeSlot[] {
  const tz = input.viewerTz ?? input.schedule.timezone
  const slots = getAvailableSlots({
    eventType: {
      durationMinutes: input.offer.durationMinutes,
      bookingWindowDays:
        input.bookingWindowDays === undefined
          ? DEFAULT_BOOKING_WINDOW_DAYS
          : input.bookingWindowDays,
      minimumNoticeMinutes:
        input.minimumNoticeMinutes ?? DEFAULT_MINIMUM_NOTICE_MINUTES,
      bufferBeforeMinutes:
        input.bufferBeforeMinutes ?? DEFAULT_BUFFER_BEFORE_MINUTES,
      bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
    },
    schedule: input.schedule,
    rules: input.rules,
    overrides: input.overrides,
    existingBookings: input.existingBookings,
    externalBusyTimes: input.externalBusyTimes ?? [],
    rangeStart: input.from,
    rangeEnd: input.to,
    slotIntervalMinutes:
      input.slotIntervalMinutes ?? DEFAULT_SLOT_INTERVAL_MINUTES,
  })

  return slots.map((slot) => ({
    ...slot,
    startLocal: formatInstantInTimezone(slot.start, tz),
    endLocal: formatInstantInTimezone(slot.end, tz),
  }))
}
