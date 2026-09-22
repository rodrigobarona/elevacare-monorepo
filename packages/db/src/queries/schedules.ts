import { and, eq, isNull, asc, count } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  schedules,
  availabilityRules,
  dateOverrides,
  eventTypeModes,
  eventTypes,
  type Schedule,
  type AvailabilityRule,
  type NewAvailabilityRule,
  type DateOverride,
  type NewDateOverride,
  type NewSchedule,
} from "../schema/main/index"

export async function getOrCreateDefaultSchedule(
  orgId: string,
  expertProfileId: string,
  timezone: string,
  txOpt?: Tx
): Promise<Schedule> {
  const run = async (tx: Tx) => {
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
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function getDefaultSchedule(
  orgId: string,
  expertProfileId: string
): Promise<Schedule | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
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
    return row
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
  timezone: string,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
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
  }
  await (txOpt ? run(txOpt) : withOrgContext(orgId, run))
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
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
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
  rules: Omit<NewAvailabilityRule, "id" | "orgId" | "createdAt">[],
  txOpt?: Tx
): Promise<AvailabilityRule[]> {
  const run = async (tx: Tx) => {
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
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
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
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
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
  data: Omit<NewDateOverride, "id" | "orgId" | "createdAt">,
  txOpt?: Tx
): Promise<DateOverride> {
  const run = async (tx: Tx) => {
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
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function deleteDateOverride(
  orgId: string,
  overrideId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .select({ id: dateOverrides.id })
      .from(dateOverrides)
      .innerJoin(schedules, eq(schedules.id, dateOverrides.scheduleId))
      .where(
        and(
          eq(dateOverrides.id, overrideId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .limit(1)

    if (!row) throw new Error("unauthorized-override")

    await tx.delete(dateOverrides).where(eq(dateOverrides.id, overrideId))
  }
  await (txOpt ? run(txOpt) : withOrgContext(orgId, run))
}

export async function listSchedules(
  orgId: string,
  expertProfileId: string
): Promise<Schedule[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .orderBy(asc(schedules.name))
  })
}

export async function createSchedule(
  orgId: string,
  data: Omit<
    NewSchedule,
    "id" | "orgId" | "createdAt" | "updatedAt" | "deletedAt"
  >,
  txOpt?: Tx
): Promise<Schedule> {
  const run = async (tx: Tx) => {
    if (data.isDefault) {
      await tx
        .update(schedules)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(schedules.expertProfileId, data.expertProfileId),
            eq(schedules.isDefault, true),
            isNull(schedules.deletedAt)
          )
        )
    }

    const [created] = await tx
      .insert(schedules)
      .values({ ...data, orgId })
      .returning()
    return created!
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function updateSchedule(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  data: Partial<Pick<Schedule, "name" | "timezone" | "isDefault">>,
  txOpt?: Tx
): Promise<Schedule | undefined> {
  const run = async (tx: Tx) => {
    if (data.isDefault === true) {
      await tx
        .update(schedules)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(schedules.expertProfileId, expertProfileId),
            eq(schedules.isDefault, true),
            isNull(schedules.deletedAt)
          )
        )
    }

    const [updated] = await tx
      .update(schedules)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schedules.id, scheduleId),
          eq(schedules.expertProfileId, expertProfileId),
          isNull(schedules.deletedAt)
        )
      )
      .returning()
    return updated
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function softDeleteSchedule(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<Schedule | undefined> {
  const run = async (tx: Tx) => {
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
    if (!row) return undefined
    if (row.isDefault) {
      throw new Error("cannot-delete-default-schedule")
    }

    const [deleted] = await tx
      .update(schedules)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isDefault: false })
      .where(eq(schedules.id, scheduleId))
      .returning()
    return deleted
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function countModesUsingSchedule(
  orgId: string,
  scheduleId: string
): Promise<number> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({ value: count() })
      .from(eventTypeModes)
      .innerJoin(eventTypes, eq(eventTypes.id, eventTypeModes.eventTypeId))
      .where(
        and(
          eq(eventTypeModes.orgId, orgId),
          eq(eventTypeModes.scheduleId, scheduleId),
          eq(eventTypeModes.active, true),
          isNull(eventTypes.deletedAt)
        )
      )
    return Number(row?.value ?? 0)
  })
}

export async function listModeNamesUsingSchedule(
  orgId: string,
  scheduleId: string
): Promise<{ modeId: string; eventTypeTitle: string | null; mode: string }[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const rows = await tx
      .select({
        modeId: eventTypeModes.id,
        mode: eventTypeModes.mode,
        eventTypeTitle: eventTypes.title,
      })
      .from(eventTypeModes)
      .innerJoin(eventTypes, eq(eventTypes.id, eventTypeModes.eventTypeId))
      .where(
        and(
          eq(eventTypeModes.orgId, orgId),
          eq(eventTypeModes.scheduleId, scheduleId),
          eq(eventTypeModes.active, true),
          isNull(eventTypes.deletedAt)
        )
      )
    return rows.map((row) => ({
      modeId: row.modeId,
      mode: row.mode,
      eventTypeTitle:
        typeof row.eventTypeTitle === "object" &&
        row.eventTypeTitle &&
        "en" in row.eventTypeTitle
          ? ((row.eventTypeTitle as { en?: string }).en ?? null)
          : null,
    }))
  })
}

export async function replaceDateOverrides(
  orgId: string,
  scheduleId: string,
  expertProfileId: string,
  overrides: Omit<
    NewDateOverride,
    "id" | "orgId" | "createdAt" | "scheduleId"
  >[],
  txOpt?: Tx
): Promise<DateOverride[]> {
  const run = async (tx: Tx) => {
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
      .delete(dateOverrides)
      .where(eq(dateOverrides.scheduleId, scheduleId))

    if (overrides.length === 0) return []

    return tx
      .insert(dateOverrides)
      .values(
        overrides.map((o) => ({
          ...o,
          orgId,
          scheduleId,
        }))
      )
      .returning()
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}
