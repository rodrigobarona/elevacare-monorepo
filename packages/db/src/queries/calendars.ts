import { and, eq, isNull } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  expertIntegrations,
  calendarBusySources,
  calendarDestinations,
  type ExpertIntegration,
} from "../schema/main/index"

/**
 * List calendar integrations for an expert.
 * Filters `expert_integrations` by `category = 'calendar'`.
 */
export async function listCalendarIntegrations(
  orgId: string,
  expertProfileId: string
): Promise<ExpertIntegration[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select()
      .from(expertIntegrations)
      .where(
        and(
          eq(expertIntegrations.expertProfileId, expertProfileId),
          eq(expertIntegrations.category, "calendar"),
          eq(expertIntegrations.status, "connected"),
          isNull(expertIntegrations.deletedAt)
        )
      )
  })
}

/**
 * List all integrations for an expert, optionally filtered by category.
 */
export async function listExpertIntegrations(
  orgId: string,
  expertProfileId: string,
  category?: string
): Promise<ExpertIntegration[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const conditions = [eq(expertIntegrations.expertProfileId, expertProfileId)]
    if (category) {
      conditions.push(
        eq(
          expertIntegrations.category,
          category as ExpertIntegration["category"]
        )
      )
    }
    return tx
      .select()
      .from(expertIntegrations)
      .where(and(...conditions))
  })
}

export async function disconnectIntegration(
  orgId: string,
  integrationId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
    await tx
      .update(expertIntegrations)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(
        and(
          eq(expertIntegrations.id, integrationId),
          eq(expertIntegrations.expertProfileId, expertProfileId)
        )
      )
  }
  await (txOpt ? run(txOpt) : withOrgContext(orgId, run))
}

export async function listBusySourcesForExpert(
  orgId: string,
  expertProfileId: string
): Promise<
  {
    expertIntegrationId: string
    externalCalendarId: string
    displayName: string
    enabled: boolean
  }[]
> {
  return withOrgContext(orgId, async (tx: Tx) => {
    return tx
      .select({
        expertIntegrationId: calendarBusySources.expertIntegrationId,
        externalCalendarId: calendarBusySources.externalCalendarId,
        displayName: calendarBusySources.displayName,
        enabled: calendarBusySources.enabled,
      })
      .from(calendarBusySources)
      .innerJoin(
        expertIntegrations,
        eq(calendarBusySources.expertIntegrationId, expertIntegrations.id)
      )
      .where(
        and(
          eq(expertIntegrations.expertProfileId, expertProfileId),
          eq(expertIntegrations.orgId, orgId),
          isNull(expertIntegrations.deletedAt)
        )
      )
  })
}

export async function getDestinationCalendar(
  orgId: string,
  expertProfileId: string
): Promise<{
  expertIntegrationId: string
  externalCalendarId: string
  displayName: string
  reminderMinutes: number | null
} | null> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        expertIntegrationId: calendarDestinations.expertIntegrationId,
        externalCalendarId: calendarDestinations.externalCalendarId,
        displayName: calendarDestinations.displayName,
        reminderMinutes: calendarDestinations.reminderMinutes,
      })
      .from(calendarDestinations)
      .where(eq(calendarDestinations.expertProfileId, expertProfileId))
      .limit(1)
    return row ?? null
  })
}

export async function replaceBusySources(
  orgId: string,
  integrationId: string,
  sources: { externalCalendarId: string; displayName: string }[],
  expertProfileId: string,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
    const [owner] = await tx
      .select({ id: expertIntegrations.id })
      .from(expertIntegrations)
      .where(
        and(
          eq(expertIntegrations.id, integrationId),
          eq(expertIntegrations.expertProfileId, expertProfileId)
        )
      )
      .limit(1)

    if (!owner) throw new Error("unauthorized-calendar")

    await tx
      .delete(calendarBusySources)
      .where(eq(calendarBusySources.expertIntegrationId, integrationId))

    if (sources.length > 0) {
      await tx.insert(calendarBusySources).values(
        sources.map((s) => ({
          orgId,
          expertIntegrationId: integrationId,
          externalCalendarId: s.externalCalendarId,
          displayName: s.displayName,
        }))
      )
    }
  }
  await (txOpt ? run(txOpt) : withOrgContext(orgId, run))
}

export async function replaceDestinationCalendar(
  orgId: string,
  expertProfileId: string,
  integrationId: string,
  externalCalendarId: string,
  displayName: string,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
    const [owner] = await tx
      .select({ id: expertIntegrations.id })
      .from(expertIntegrations)
      .where(
        and(
          eq(expertIntegrations.id, integrationId),
          eq(expertIntegrations.expertProfileId, expertProfileId)
        )
      )
      .limit(1)

    if (!owner) throw new Error("unauthorized-calendar")

    // One row per expert. Upsert so the reminder survives a calendar change.
    await tx
      .insert(calendarDestinations)
      .values({
        orgId,
        expertProfileId,
        expertIntegrationId: integrationId,
        externalCalendarId,
        displayName,
      })
      .onConflictDoUpdate({
        target: calendarDestinations.expertProfileId,
        set: {
          expertIntegrationId: integrationId,
          externalCalendarId,
          displayName,
          updatedAt: new Date(),
        },
      })
  }
  await (txOpt ? run(txOpt) : withOrgContext(orgId, run))
}

/**
 * Set the reminder on sessions Eleva adds to the expert's calendar. `null`
 * means the calendar's usual reminder. Returns false when the expert has no
 * destination calendar yet, because the reminder lives with it.
 */
export async function setCalendarReminder(
  orgId: string,
  expertProfileId: string,
  reminderMinutes: number | null,
  txOpt?: Tx
): Promise<boolean> {
  const run = async (tx: Tx) => {
    const updated = await tx
      .update(calendarDestinations)
      .set({ reminderMinutes, updatedAt: new Date() })
      .where(eq(calendarDestinations.expertProfileId, expertProfileId))
      .returning({ id: calendarDestinations.id })
    return updated.length > 0
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}
