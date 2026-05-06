import { and, eq, isNull, asc } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  schedules,
  availabilityRules,
  dateOverrides,
  type Schedule,
  type AvailabilityRule,
  type NewAvailabilityRule,
  type DateOverride,
  type NewDateOverride,
} from "../schema/main/index"

export async function getOrCreateDefaultSchedule(
  orgId: string,
  expertProfileId: string,
  timezone: string
): Promise<Schedule> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [existing] = await tx
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.expertProfileId, expertProfileId),
          eq(schedules.isDefault, true),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (existing) return existing

    const [created] = await tx
      .insert(schedules)
      .values({
        orgId,
        expertProfileId,
        name: "Default",
        timezone,
        isDefault: true,
      })
      .returning()
    return created!
  })
}

export async function getSchedule(
  orgId: string,
  scheduleId: string,
  expertProfileId: string
): Promise<Schedule | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)
    return row
  })
}

export async function updateScheduleTimezone(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  timezone: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(schedules)
      .set({ timezone, updatedAt: new Date() })
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
  })
}

export async function listAvailabilityRules(
  orgId: string,
  scheduleId: string,
  expertProfileId: string
): Promise<AvailabilityRule[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(availabilityRules)
      .innerJoin(schedules, eq(schedules.id, availabilityRules.scheduleId))
      .where(
        and(
          eq(availabilityRules.scheduleId, scheduleId),
          eq(schedules.expertProfileId, expertProfileId)
        )
      )
      .orderBy(
        asc(availabilityRules.dayOfWeek),
        asc(availabilityRules.startTime)
      )
      .then((rows) => rows.map((r) => r.availability_rules))
  })
}

export async function replaceAvailabilityRules(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  rules: Omit<NewAvailabilityRule, "id" | "orgId" | "createdAt">[]
): Promise<AvailabilityRule[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [sched] = await tx
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (!sched) throw new Error("unauthorized-schedule")

    await tx
      .delete(availabilityRules)
      .where(eq(availabilityRules.scheduleId, scheduleId))

    if (rules.length === 0) return []

    return tx
      .insert(availabilityRules)
      .values(rules.map((r) => ({ ...r, orgId, scheduleId })))
      .returning()
  })
}

export async function listDateOverrides(
  orgId: string,
  scheduleId: string,
  expertProfileId: string
): Promise<DateOverride[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(dateOverrides)
      .innerJoin(schedules, eq(schedules.id, dateOverrides.scheduleId))
      .where(
        and(
          eq(dateOverrides.scheduleId, scheduleId),
          eq(schedules.expertProfileId, expertProfileId)
        )
      )
      .orderBy(asc(dateOverrides.overrideDate))
      .then((rows) => rows.map((r) => r.date_overrides))
  })
}

export async function upsertDateOverride(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  data: Omit<NewDateOverride, "id" | "orgId" | "createdAt">
): Promise<DateOverride> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [sched] = await tx
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (!sched) throw new Error("unauthorized-schedule")

    const [existing] = await tx
      .select()
      .from(dateOverrides)
      .where(
        and(
          eq(dateOverrides.scheduleId, scheduleId),
          eq(dateOverrides.overrideDate, data.overrideDate)
        )
      )
      .limit(1)

    if (existing) {
      const [updated] = await tx
        .update(dateOverrides)
        .set({
          startTime: data.startTime,
          endTime: data.endTime,
          isBlocked: data.isBlocked,
        })
        .where(eq(dateOverrides.id, existing.id))
        .returning()
      return updated!
    }

    const [created] = await tx
      .insert(dateOverrides)
      .values({ ...data, orgId, scheduleId })
      .returning()
    return created!
  })
}

export async function deleteDateOverride(
  orgId: string,
  overrideId: string,
  expertProfileId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({ id: dateOverrides.id })
      .from(dateOverrides)
      .innerJoin(schedules, eq(schedules.id, dateOverrides.scheduleId))
      .where(
        and(
          eq(dateOverrides.id, overrideId),
          eq(schedules.expertProfileId, expertProfileId)
        )
      )
      .limit(1)

    if (!row) throw new Error("unauthorized-override")

    await tx.delete(dateOverrides).where(eq(dateOverrides.id, overrideId))
  })
}
