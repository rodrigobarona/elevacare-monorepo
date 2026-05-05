import { and, eq, isNull, asc } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  schedules,
  availabilityRules,
  dateOverrides,
  type Schedule,
  type NewSchedule,
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
  scheduleId: string
): Promise<Schedule | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, scheduleId), isNull(schedules.deletedAt)))
      .limit(1)
    return row
  })
}

export async function updateScheduleTimezone(
  orgId: string,
  scheduleId: string,
  timezone: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(schedules)
      .set({ timezone, updatedAt: new Date() })
      .where(eq(schedules.id, scheduleId))
  })
}

export async function listAvailabilityRules(
  orgId: string,
  scheduleId: string
): Promise<AvailabilityRule[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.scheduleId, scheduleId))
      .orderBy(
        asc(availabilityRules.dayOfWeek),
        asc(availabilityRules.startTime)
      )
  })
}

export async function replaceAvailabilityRules(
  orgId: string,
  scheduleId: string,
  rules: Omit<NewAvailabilityRule, "id" | "orgId" | "createdAt">[]
): Promise<AvailabilityRule[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
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
  scheduleId: string
): Promise<DateOverride[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(dateOverrides)
      .where(eq(dateOverrides.scheduleId, scheduleId))
      .orderBy(asc(dateOverrides.overrideDate))
  })
}

export async function upsertDateOverride(
  orgId: string,
  scheduleId: string,
  data: Omit<NewDateOverride, "id" | "orgId" | "createdAt">
): Promise<DateOverride> {
  return withOrgContext(orgId, async (tx: Tx) => {
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
  overrideId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx.delete(dateOverrides).where(eq(dateOverrides.id, overrideId))
  })
}
