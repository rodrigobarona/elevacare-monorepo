import { and, eq, isNull } from "drizzle-orm"
import {
  resolveCalendarDestination,
  type CalendarDestinationRef,
} from "@eleva/calendar"
import { withOrgContext, type Tx } from "../context"
import {
  calendarDestinations,
  eventTypeModes,
  eventTypes,
  expertIntegrations,
} from "../schema/main/index"

export type DestinationOverridePatch = {
  destinationIntegrationId: string | null
  destinationExternalCalendarId: string | null
}

export type ResolvedDestination = CalendarDestinationRef

/**
 * Ensure the integration is a connected calendar owned by this expert.
 */
export async function assertExpertOwnsCalendarIntegration(
  orgId: string,
  expertProfileId: string,
  integrationId: string,
  txOpt?: Tx
): Promise<boolean> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .select({ id: expertIntegrations.id })
      .from(expertIntegrations)
      .where(
        and(
          eq(expertIntegrations.id, integrationId),
          eq(expertIntegrations.orgId, orgId),
          eq(expertIntegrations.expertProfileId, expertProfileId),
          eq(expertIntegrations.category, "calendar"),
          eq(expertIntegrations.status, "connected"),
          isNull(expertIntegrations.deletedAt)
        )
      )
      .limit(1)
    return Boolean(row)
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function setEventTypeDestination(
  orgId: string,
  eventTypeId: string,
  expertProfileId: string,
  patch: DestinationOverridePatch,
  txOpt?: Tx
): Promise<boolean> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .update(eventTypes)
      .set({
        destinationIntegrationId: patch.destinationIntegrationId,
        destinationExternalCalendarId: patch.destinationExternalCalendarId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.expertProfileId, expertProfileId),
          eq(eventTypes.orgId, orgId),
          isNull(eventTypes.deletedAt)
        )
      )
      .returning({ id: eventTypes.id })
    return row != null
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function setEventTypeModeDestination(
  orgId: string,
  eventTypeId: string,
  modeId: string,
  patch: DestinationOverridePatch,
  txOpt?: Tx
): Promise<boolean> {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .update(eventTypeModes)
      .set({
        destinationIntegrationId: patch.destinationIntegrationId,
        destinationExternalCalendarId: patch.destinationExternalCalendarId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(eventTypeModes.id, modeId),
          eq(eventTypeModes.eventTypeId, eventTypeId),
          eq(eventTypeModes.orgId, orgId)
        )
      )
      .returning({ id: eventTypeModes.id })
    return row != null
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

async function usableOverride(
  orgId: string,
  expertProfileId: string,
  override: {
    destinationIntegrationId: string | null
    destinationExternalCalendarId: string | null
  } | null,
  tx: Tx
): Promise<{
  destinationIntegrationId: string | null
  destinationExternalCalendarId: string | null
} | null> {
  if (
    !override?.destinationIntegrationId ||
    !override.destinationExternalCalendarId
  ) {
    return null
  }
  const owns = await assertExpertOwnsCalendarIntegration(
    orgId,
    expertProfileId,
    override.destinationIntegrationId,
    tx
  )
  return owns ? override : null
}

/**
 * Resolve destination for a booking write using
 * mode override > event type override > calendar_destinations default.
 * Skips overrides whose integration is no longer connected.
 */
export async function resolveBookingDestination(
  orgId: string,
  expertProfileId: string,
  eventTypeId: string,
  eventTypeModeId: string | null,
  txOpt?: Tx
): Promise<ResolvedDestination | null> {
  const run = async (tx: Tx) => {
    const [eventType] = await tx
      .select({
        destinationIntegrationId: eventTypes.destinationIntegrationId,
        destinationExternalCalendarId: eventTypes.destinationExternalCalendarId,
      })
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.id, eventTypeId),
          eq(eventTypes.expertProfileId, expertProfileId),
          isNull(eventTypes.deletedAt)
        )
      )
      .limit(1)

    let modeOverride: {
      destinationIntegrationId: string | null
      destinationExternalCalendarId: string | null
    } | null = null

    if (eventTypeModeId) {
      const [mode] = await tx
        .select({
          destinationIntegrationId: eventTypeModes.destinationIntegrationId,
          destinationExternalCalendarId:
            eventTypeModes.destinationExternalCalendarId,
        })
        .from(eventTypeModes)
        .where(
          and(
            eq(eventTypeModes.id, eventTypeModeId),
            eq(eventTypeModes.eventTypeId, eventTypeId)
          )
        )
        .limit(1)
      modeOverride = mode ?? null
    }

    const [expertDefault] = await tx
      .select({
        expertIntegrationId: calendarDestinations.expertIntegrationId,
        externalCalendarId: calendarDestinations.externalCalendarId,
      })
      .from(calendarDestinations)
      .where(eq(calendarDestinations.expertProfileId, expertProfileId))
      .limit(1)

    const usableMode = await usableOverride(
      orgId,
      expertProfileId,
      modeOverride,
      tx
    )
    const usableEventType = await usableOverride(
      orgId,
      expertProfileId,
      eventType ?? null,
      tx
    )

    return resolveCalendarDestination({
      modeOverride: usableMode,
      eventTypeOverride: usableEventType,
      expertDefault: expertDefault ?? null,
    })
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}
