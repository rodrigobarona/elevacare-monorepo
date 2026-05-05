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
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
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
  } catch {
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

    const ruleError = validateBookingRules({
      eventType: {
        bookingWindowDays: eventType.bookingWindowDays,
        minimumNoticeMinutes: eventType.minimumNoticeMinutes,
        cancellationWindowHours: null,
        rescheduleWindowHours: null,
      },
      slotStart: new Date(slotStartIso),
    })

    if (ruleError) return { ok: false, error: ruleError }

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
      endsAt: new Date(slotEndIso),
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
  } catch {
    return { ok: false, error: "reserve-failed" }
  }
}
