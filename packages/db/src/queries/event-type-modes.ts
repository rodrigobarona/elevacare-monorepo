import { and, asc, eq } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  eventTypeModes,
  expertPracticeLocations,
  type EventTypeMode,
  type NewEventTypeMode,
} from "../schema/main/index"

export async function listEventTypeModes(
  orgId: string,
  eventTypeId: string,
  options?: { includeInactive?: boolean }
): Promise<EventTypeMode[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const filters = [eq(eventTypeModes.eventTypeId, eventTypeId)]
    if (!options?.includeInactive) {
      filters.push(eq(eventTypeModes.active, true))
    }
    return tx
      .select()
      .from(eventTypeModes)
      .where(and(...filters))
      .orderBy(asc(eventTypeModes.sortOrder), asc(eventTypeModes.createdAt))
  })
}

export async function getEventTypeMode(
  orgId: string,
  modeId: string,
  eventTypeId: string
): Promise<EventTypeMode | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(eventTypeModes)
      .where(
        and(
          eq(eventTypeModes.id, modeId),
          eq(eventTypeModes.eventTypeId, eventTypeId)
        )
      )
      .limit(1)
    return row
  })
}

export async function createEventTypeMode(
  orgId: string,
  data: Omit<NewEventTypeMode, "id" | "orgId" | "createdAt" | "updatedAt">,
  txOpt?: Tx
): Promise<EventTypeMode> {
  const run = async (tx: Tx) => {
    const [created] = await tx
      .insert(eventTypeModes)
      .values({ ...data, orgId })
      .returning()
    return created!
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function updateEventTypeMode(
  orgId: string,
  modeId: string,
  eventTypeId: string,
  data: Partial<
    Omit<
      NewEventTypeMode,
      "id" | "orgId" | "eventTypeId" | "createdAt" | "updatedAt"
    >
  >,
  txOpt?: Tx
): Promise<EventTypeMode | undefined> {
  const run = async (tx: Tx) => {
    const [updated] = await tx
      .update(eventTypeModes)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(eventTypeModes.id, modeId),
          eq(eventTypeModes.eventTypeId, eventTypeId)
        )
      )
      .returning()
    return updated
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function deactivateEventTypeMode(
  orgId: string,
  modeId: string,
  eventTypeId: string,
  txOpt?: Tx
): Promise<EventTypeMode | undefined> {
  return updateEventTypeMode(
    orgId,
    modeId,
    eventTypeId,
    { active: false },
    txOpt
  )
}

export type EventTypeModeWithLocation = EventTypeMode & {
  locationCountry: string | null
}

export async function listEventTypeModesWithLocation(
  orgId: string,
  eventTypeId: string
): Promise<EventTypeModeWithLocation[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const rows = await tx
      .select({
        mode: eventTypeModes,
        locationCountry: expertPracticeLocations.country,
      })
      .from(eventTypeModes)
      .leftJoin(
        expertPracticeLocations,
        eq(expertPracticeLocations.id, eventTypeModes.locationId)
      )
      .where(eq(eventTypeModes.eventTypeId, eventTypeId))
      .orderBy(asc(eventTypeModes.sortOrder), asc(eventTypeModes.createdAt))

    return rows.map((row) => ({
      ...row.mode,
      locationCountry: row.locationCountry ?? null,
    }))
  })
}
