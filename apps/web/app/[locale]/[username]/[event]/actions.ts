"use server"

import { Redis } from "@upstash/redis"
import { env } from "@eleva/config/env"
import {
  findExpertByUsername,
  findPublicEventType,
  getExpertScheduleForBooking,
  listExpertBusyBookings,
} from "@eleva/db"
import {
  getAvailableSlots,
  reserveSlot,
  validateBookingRules,
} from "@eleva/scheduling"

export interface SlotData {
  start: string
  end: string
}

export async function loadSlots(
  username: string,
  eventSlug: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<{ ok: true; slots: SlotData[] } | { ok: false; error: string }> {
  try {
    const expert = await findExpertByUsername(username)
    if (!expert) return { ok: false, error: "expert-not-found" }

    const eventType = await findPublicEventType(expert.id, eventSlug)
    if (!eventType) return { ok: false, error: "event-not-found" }

    const { schedule, rules, overrides } = await getExpertScheduleForBooking(
      expert.id
    )
    if (!schedule) return { ok: true, slots: [] }

    const rangeStart = new Date(rangeStartIso)
    const rangeEnd = new Date(rangeEndIso)

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime())
    ) {
      return { ok: false, error: "invalid-date-range" }
    }

    const existingBookings = await listExpertBusyBookings(
      expert.id,
      rangeStart,
      rangeEnd
    )

    const slots = getAvailableSlots({
      eventType: {
        durationMinutes: eventType.durationMinutes,
        bookingWindowDays: eventType.bookingWindowDays,
        minimumNoticeMinutes: eventType.minimumNoticeMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
      },
      schedule: { timezone: schedule.timezone },
      rules,
      overrides,
      existingBookings,
      externalBusyTimes: [],
      rangeStart,
      rangeEnd,
    })

    return {
      ok: true,
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    }
  } catch (err) {
    console.error("[loadSlots]", err)
    return { ok: false, error: "load-failed" }
  }
}

export async function reserveSlotAction(
  username: string,
  eventSlug: string,
  slotStartIso: string,
  slotEndIso: string
): Promise<
  | { ok: true; reservationId: string; holdToken: string; expiresAt: string }
  | { ok: false; error: string }
> {
  try {
    const expert = await findExpertByUsername(username)
    if (!expert) return { ok: false, error: "expert-not-found" }

    const eventType = await findPublicEventType(expert.id, eventSlug)
    if (!eventType) return { ok: false, error: "event-not-found" }

    const slotStart = new Date(slotStartIso)

    const ruleError = validateBookingRules({
      eventType: {
        bookingWindowDays: eventType.bookingWindowDays,
        minimumNoticeMinutes: eventType.minimumNoticeMinutes,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart,
    })

    if (ruleError) return { ok: false, error: ruleError }

    const { schedule, rules, overrides } = await getExpertScheduleForBooking(
      expert.id
    )
    if (!schedule) return { ok: false, error: "no-schedule" }

    const dayStart = new Date(slotStart)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(slotStart)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const existingBookings = await listExpertBusyBookings(
      expert.id,
      dayStart,
      dayEnd
    )

    const availableSlots = getAvailableSlots({
      eventType: {
        durationMinutes: eventType.durationMinutes,
        bookingWindowDays: eventType.bookingWindowDays,
        minimumNoticeMinutes: eventType.minimumNoticeMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
      },
      schedule: { timezone: schedule.timezone },
      rules,
      overrides,
      existingBookings,
      externalBusyTimes: [],
      rangeStart: dayStart,
      rangeEnd: dayEnd,
    })

    const slotMatch = availableSlots.some(
      (s) => s.start.getTime() === slotStart.getTime()
    )
    if (!slotMatch) return { ok: false, error: "slot-unavailable" }

    const e = env()
    if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) {
      return { ok: false, error: "redis-not-configured" }
    }

    const redis = new Redis({
      url: e.UPSTASH_REDIS_REST_URL,
      token: e.UPSTASH_REDIS_REST_TOKEN,
    })

    const holdToken = crypto.randomUUID()
    const ttlSeconds = 300

    const result = await reserveSlot(redis, {
      eventTypeId: eventType.id,
      expertProfileId: expert.id,
      orgId: expert.orgId,
      startsAt: new Date(slotStartIso),
      endsAt: new Date(
        new Date(slotStartIso).getTime() + eventType.durationMinutes * 60_000
      ),
      holdToken,
      ttlSeconds,
    })

    if (!result.success) {
      return { ok: false, error: result.error ?? "reservation-failed" }
    }

    return {
      ok: true,
      reservationId: result.reservationId!,
      holdToken,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }
  } catch (err) {
    console.error("[reserveSlotAction]", err)
    return { ok: false, error: "reserve-failed" }
  }
}
