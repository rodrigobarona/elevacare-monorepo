import { and, eq, gt, lt, isNull, asc, notInArray } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext, type Tx } from "../context"
import {
  schedules,
  availabilityRules,
  dateOverrides,
  bookings,
  slotReservations,
  type Schedule,
  type AvailabilityRule,
  type DateOverride,
} from "../schema/main/index"

export interface BookingScheduleData {
  schedule: Pick<Schedule, "id" | "timezone"> | null
  rules: Pick<AvailabilityRule, "dayOfWeek" | "startTime" | "endTime">[]
  overrides: Pick<
    DateOverride,
    "overrideDate" | "startTime" | "endTime" | "isBlocked"
  >[]
}

/**
 * Fetch an expert's default schedule with rules and overrides.
 * Runs in platform-admin context (no RLS) — safe for the public
 * booking funnel.
 */
export async function getExpertScheduleForBooking(
  expertProfileId: string
): Promise<BookingScheduleData> {
  return withPlatformAdminContext(async (tx: Tx) => {
    const [schedule] = await tx
      .select({ id: schedules.id, timezone: schedules.timezone })
      .from(schedules)
      .where(
        and(
          eq(schedules.expertProfileId, expertProfileId),
          eq(schedules.isDefault, true),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (!schedule) {
      return { schedule: null, rules: [], overrides: [] }
    }

    const windows = await loadScheduleWindows(tx, schedule.id)
    return { schedule, ...windows }
  })
}

export async function getScheduleForBooking(
  orgId: string,
  scheduleId: string
): Promise<BookingScheduleData> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [schedule] = await tx
      .select({ id: schedules.id, timezone: schedules.timezone })
      .from(schedules)
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.orgId, orgId),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (!schedule) {
      return { schedule: null, rules: [], overrides: [] }
    }

    const windows = await loadScheduleWindows(tx, schedule.id)
    return { schedule, ...windows }
  })
}

async function loadScheduleWindows(tx: Tx, scheduleId: string) {
  const rules = await tx
    .select({
      dayOfWeek: availabilityRules.dayOfWeek,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.scheduleId, scheduleId))
    .orderBy(asc(availabilityRules.dayOfWeek), asc(availabilityRules.startTime))

  const overrides = await tx
    .select({
      overrideDate: dateOverrides.overrideDate,
      startTime: dateOverrides.startTime,
      endTime: dateOverrides.endTime,
      isBlocked: dateOverrides.isBlocked,
    })
    .from(dateOverrides)
    .where(eq(dateOverrides.scheduleId, scheduleId))
    .orderBy(asc(dateOverrides.overrideDate))

  return { rules, overrides }
}

/**
 * Fetch existing confirmed/pending bookings for an expert in a
 * date range. Used by the slot availability engine to filter out
 * busy intervals. Runs in platform-admin context.
 */
export async function listExpertBusyBookings(
  expertProfileId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ start: Date; end: Date }[]> {
  return withPlatformAdminContext(async (tx: Tx) => {
    const rows = await tx
      .select({
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.expertProfileId, expertProfileId),
          notInArray(bookings.status, ["cancelled", "no_show"]),
          lt(bookings.startsAt, rangeEnd),
          gt(bookings.endsAt, rangeStart)
        )
      )

    const holds = await tx
      .select({
        startsAt: slotReservations.startsAt,
        endsAt: slotReservations.endsAt,
      })
      .from(slotReservations)
      .where(
        and(
          eq(slotReservations.expertProfileId, expertProfileId),
          eq(slotReservations.status, "active"),
          gt(slotReservations.expiresAt, new Date()),
          lt(slotReservations.startsAt, rangeEnd),
          gt(slotReservations.endsAt, rangeStart)
        )
      )

    return [...rows, ...holds].map((r) => ({
      start: r.startsAt,
      end: r.endsAt,
    }))
  })
}
