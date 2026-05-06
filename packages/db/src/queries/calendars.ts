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
  expertProfileId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
    await tx
      .update(expertIntegrations)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(
        and(
          eq(expertIntegrations.id, integrationId),
          eq(expertIntegrations.expertProfileId, expertProfileId)
        )
      )
  })
}

export async function replaceBusySources(
  orgId: string,
  integrationId: string,
  sources: { externalCalendarId: string; displayName: string }[],
  expertProfileId: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
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
  })
}

export async function replaceDestinationCalendar(
  orgId: string,
  expertProfileId: string,
  integrationId: string,
  externalCalendarId: string,
  displayName: string
): Promise<void> {
  await withOrgContext(orgId, async (tx: Tx) => {
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
      .delete(calendarDestinations)
      .where(eq(calendarDestinations.expertProfileId, expertProfileId))

    await tx.insert(calendarDestinations).values({
      orgId,
      expertProfileId,
      expertIntegrationId: integrationId,
      externalCalendarId,
      displayName,
    })
  })
}
