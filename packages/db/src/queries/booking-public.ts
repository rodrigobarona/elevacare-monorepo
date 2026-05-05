import { and, eq, gte, lte, sql, isNull, asc } from "drizzle-orm"
import { withPlatformAdminContext, type Tx } from "../context"
import {
  schedules,
  availabilityRules,
  dateOverrides,
  bookings,
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

    const rules = await tx
      .select({
        dayOfWeek: availabilityRules.dayOfWeek,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
      })
      .from(availabilityRules)
      .where(eq(availabilityRules.scheduleId, schedule.id))
      .orderBy(
        asc(availabilityRules.dayOfWeek),
        asc(availabilityRules.startTime)
      )

    const ovs = await tx
      .select({
        overrideDate: dateOverrides.overrideDate,
        startTime: dateOverrides.startTime,
        endTime: dateOverrides.endTime,
        isBlocked: dateOverrides.isBlocked,
      })
      .from(dateOverrides)
      .where(eq(dateOverrides.scheduleId, schedule.id))
      .orderBy(asc(dateOverrides.overrideDate))

    return { schedule, rules, overrides: ovs }
  })
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
          sql`${bookings.status} NOT IN ('cancelled', 'no_show')`,
          gte(bookings.startsAt, rangeStart),
          lte(bookings.endsAt, rangeEnd)
        )
      )

    return rows.map((r) => ({ start: r.startsAt, end: r.endsAt }))
  })
}
