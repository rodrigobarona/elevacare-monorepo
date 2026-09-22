import { and, count, eq, inArray, isNull, asc } from "drizzle-orm"
import { withOrgContext, type Tx } from "../context"
import {
  eventTypeModes,
  eventTypes,
  expertPracticeLocations,
  type ExpertPracticeLocation,
  type NewExpertPracticeLocation,
} from "../schema/main/index"

export async function listPracticeLocations(
  orgId: string,
  expertProfileId: string,
  options?: { includeInactive?: boolean }
): Promise<ExpertPracticeLocation[]> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const filters = [
      eq(expertPracticeLocations.expertProfileId, expertProfileId),
    ]
    if (!options?.includeInactive) {
      filters.push(eq(expertPracticeLocations.active, true))
    }
    return tx
      .select()
      .from(expertPracticeLocations)
      .where(and(...filters))
      .orderBy(asc(expertPracticeLocations.name))
  })
}

export async function getPracticeLocation(
  orgId: string,
  locationId: string,
  expertProfileId: string
): Promise<ExpertPracticeLocation | undefined> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select()
      .from(expertPracticeLocations)
      .where(
        and(
          eq(expertPracticeLocations.id, locationId),
          eq(expertPracticeLocations.expertProfileId, expertProfileId)
        )
      )
      .limit(1)
    return row
  })
}

export async function createPracticeLocation(
  orgId: string,
  data: Omit<
    NewExpertPracticeLocation,
    "id" | "orgId" | "createdAt" | "updatedAt"
  >,
  txOpt?: Tx
): Promise<ExpertPracticeLocation> {
  const run = async (tx: Tx) => {
    if (data.isPrimary) {
      await tx
        .update(expertPracticeLocations)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(expertPracticeLocations.expertProfileId, data.expertProfileId),
            eq(expertPracticeLocations.isPrimary, true)
          )
        )
    }

    const [created] = await tx
      .insert(expertPracticeLocations)
      .values({ ...data, orgId })
      .returning()
    return created!
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function updatePracticeLocation(
  orgId: string,
  locationId: string,
  expertProfileId: string,
  data: Partial<
    Omit<
      NewExpertPracticeLocation,
      "id" | "orgId" | "expertProfileId" | "createdAt"
    >
  >,
  txOpt?: Tx
): Promise<ExpertPracticeLocation | undefined> {
  const run = async (tx: Tx) => {
    if (data.isPrimary === true) {
      await tx
        .update(expertPracticeLocations)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(expertPracticeLocations.expertProfileId, expertProfileId),
            eq(expertPracticeLocations.isPrimary, true)
          )
        )
    }

    const [updated] = await tx
      .update(expertPracticeLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(expertPracticeLocations.id, locationId),
          eq(expertPracticeLocations.expertProfileId, expertProfileId)
        )
      )
      .returning()
    return updated
  }
  return txOpt ? run(txOpt) : withOrgContext(orgId, run)
}

export async function archivePracticeLocation(
  orgId: string,
  locationId: string,
  expertProfileId: string,
  txOpt?: Tx
): Promise<ExpertPracticeLocation | undefined> {
  return updatePracticeLocation(
    orgId,
    locationId,
    expertProfileId,
    { active: false, isPrimary: false },
    txOpt
  )
}

export async function countModesUsingLocation(
  orgId: string,
  locationId: string
): Promise<number> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({ value: count() })
      .from(eventTypeModes)
      .where(
        and(
          eq(eventTypeModes.orgId, orgId),
          eq(eventTypeModes.locationId, locationId),
          eq(eventTypeModes.active, true)
        )
      )
    return Number(row?.value ?? 0)
  })
}

export async function listModeNamesUsingLocation(
  orgId: string,
  locationId: string
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
          eq(eventTypeModes.locationId, locationId),
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

export async function listPublishedActiveModesForExpert(
  orgId: string,
  expertProfileId: string
): Promise<
  {
    modeId: string
    eventTypeId: string
    eventTypeTitle: string | null
    kind: "clinical" | "non_clinical"
    mode: "online" | "phone" | "in_person"
    countryScopeType: "worldwide" | "list"
    countryScopeCodes: string[]
    languages: string[]
    locationCountry: string | null
  }[]
> {
  return withOrgContext(orgId, async (tx: Tx) => {
    const rows = await tx
      .select({
        modeId: eventTypeModes.id,
        eventTypeId: eventTypeModes.eventTypeId,
        eventTypeTitle: eventTypes.title,
        kind: eventTypes.kind,
        mode: eventTypeModes.mode,
        countryScopeType: eventTypeModes.countryScopeType,
        countryScopeCodes: eventTypeModes.countryScopeCodes,
        languages: eventTypeModes.languages,
        locationCountry: expertPracticeLocations.country,
      })
      .from(eventTypeModes)
      .innerJoin(eventTypes, eq(eventTypes.id, eventTypeModes.eventTypeId))
      .leftJoin(
        expertPracticeLocations,
        eq(expertPracticeLocations.id, eventTypeModes.locationId)
      )
      .where(
        and(
          eq(eventTypes.orgId, orgId),
          eq(eventTypes.expertProfileId, expertProfileId),
          eq(eventTypes.published, true),
          eq(eventTypes.active, true),
          isNull(eventTypes.deletedAt),
          eq(eventTypeModes.active, true),
          inArray(eventTypes.kind, ["clinical", "non_clinical"])
        )
      )

    return rows.map((row) => ({
      modeId: row.modeId,
      eventTypeId: row.eventTypeId,
      eventTypeTitle:
        typeof row.eventTypeTitle === "object" &&
        row.eventTypeTitle &&
        "en" in row.eventTypeTitle
          ? ((row.eventTypeTitle as { en?: string }).en ?? null)
          : null,
      kind: row.kind,
      mode: row.mode,
      countryScopeType: row.countryScopeType,
      countryScopeCodes: row.countryScopeCodes,
      languages: row.languages,
      locationCountry: row.locationCountry ?? null,
    }))
  })
}
