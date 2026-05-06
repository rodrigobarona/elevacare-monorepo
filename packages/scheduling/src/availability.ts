import type { GetAvailableSlotsInput, TimeSlot, BusyInterval } from "./types"
import {
  createUtcFromLocalTime,
  getDateParts,
  iterateDays,
  parseTimeToMinutes,
} from "./timezone"

function overlaps(
  slotStart: Date,
  slotEnd: Date,
  intervals: BusyInterval[]
): boolean {
  const s = slotStart.getTime()
  const e = slotEnd.getTime()
  return intervals.some((b) => {
    const bs = b.start.getTime()
    const be = b.end.getTime()
    return s < be && e > bs
  })
}

/**
 * Compute available booking slots for an event type given the expert's
 * schedule, availability rules, date overrides, and busy times.
 *
 * All returned slots are UTC timestamps. The schedule's timezone drives
 * wall-clock interpretation of availability windows.
 */
export function getAvailableSlots(input: GetAvailableSlotsInput): TimeSlot[] {
  const {
    eventType,
    schedule,
    rules,
    overrides,
    existingBookings,
    externalBusyTimes,
    rangeStart,
    rangeEnd,
  } = input

  const tz = schedule.timezone
  const duration = eventType.durationMinutes
  const bufferBefore = eventType.bufferBeforeMinutes
  const bufferAfter = eventType.bufferAfterMinutes
  const minimumNotice = eventType.minimumNoticeMinutes
  const bookingWindow = eventType.bookingWindowDays
  const now = new Date()

  const allBusy: BusyInterval[] = [...existingBookings, ...externalBusyTimes]

  const effectiveStart = new Date(
    Math.max(rangeStart.getTime(), now.getTime() + minimumNotice * 60_000)
  )
  let effectiveEnd = rangeEnd
  if (bookingWindow != null) {
    const windowEnd = new Date(now.getTime() + bookingWindow * 24 * 3_600_000)
    effectiveEnd = new Date(Math.min(rangeEnd.getTime(), windowEnd.getTime()))
  }

  if (effectiveStart >= effectiveEnd) return []

  const overrideMap = new Map(overrides.map((o) => [o.overrideDate, o]))
  const slots: TimeSlot[] = []

  for (const dateStr of iterateDays(effectiveStart, effectiveEnd, tz)) {
    const override = overrideMap.get(dateStr)
    if (override?.isBlocked) continue

    let windows: { startMinutes: number; endMinutes: number }[]

    if (
      override &&
      !override.isBlocked &&
      override.startTime &&
      override.endTime
    ) {
      windows = [
        {
          startMinutes: parseTimeToMinutes(override.startTime),
          endMinutes: parseTimeToMinutes(override.endTime),
        },
      ]
    } else {
      const dayParts = getDateParts(
        createUtcFromLocalTime(dateStr, 720, tz),
        tz
      )
      const dayOfWeek = dayParts.dayOfWeek
      windows = rules
        .filter((r) => r.dayOfWeek === dayOfWeek)
        .map((r) => ({
          startMinutes: parseTimeToMinutes(r.startTime),
          endMinutes: parseTimeToMinutes(r.endTime),
        }))
    }

    for (const w of windows) {
      let cursor = w.startMinutes
      while (cursor + duration <= w.endMinutes) {
        const slotStart = createUtcFromLocalTime(dateStr, cursor, tz)
        const slotEnd = createUtcFromLocalTime(dateStr, cursor + duration, tz)

        const startMs = slotStart.getTime()
        const endMs = slotEnd.getTime()

        if (
          startMs < effectiveStart.getTime() ||
          endMs > effectiveEnd.getTime()
        ) {
          cursor += duration
          continue
        }

        if (startMs < now.getTime() + minimumNotice * 60_000) {
          cursor += duration
          continue
        }

        const bufferedStart = new Date(startMs - bufferBefore * 60_000)
        const bufferedEnd = new Date(endMs + bufferAfter * 60_000)

        if (overlaps(bufferedStart, bufferedEnd, allBusy)) {
          cursor += duration
          continue
        }

        slots.push({ start: slotStart, end: slotEnd })
        cursor += duration
      }
    }
  }

  return slots
}
