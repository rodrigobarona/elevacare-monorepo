import { and, asc, desc, eq, exists, inArray, isNull, sql } from "drizzle-orm"
import { withOrgContext, withPlatformAdminContext } from "../context"
import * as main from "../schema/main"
import type { LocalizedText } from "../schema/main/shared"

export type MarketplaceSort = "relevance" | "price" | "rating"

export type ListMarketplaceExpertsInput = {
  category?: string
  language?: string
  minPrice?: number
  maxPrice?: number
  sort?: MarketplaceSort
  cursor?: string
  limit?: number
}

export type MarketplaceExpertCard = {
  username: string
  displayName: string
  headline: string | null
  avatarUrl: string | null
  languages: string[]
  serviceCountries: string[]
  categorySlugs: string[]
  minPriceCents: number | null
  topExpertActive: boolean
}

export type ListMarketplaceExpertsResult = {
  experts: MarketplaceExpertCard[]
  nextCursor: string | null
}

export type PublicEventTypeMode = {
  id: string
  mode: main.SessionMode
  priceCents: number
  currency: "EUR"
  durationMinutes: number
  countryScopeType: "worldwide" | "list"
  countryScopeCodes: string[]
  languages: string[]
  label: LocalizedText | null
  location: {
    id: string
    name: string
    city: string
    country: string
  } | null
}

export type PublicBookingLink = {
  orgId: string
  eventTypeId: string
  eventTypeModeId: string | null
  scheduleId: string | null
  priceCents: number | null
  expiresAt: Date
}

export const MAX_MARKETPLACE_OFFSET = 10_000

export function nextMarketplaceCursor(
  offset: number,
  limit: number,
  hasMore: boolean
): string | null {
  if (!hasMore || offset + limit > MAX_MARKETPLACE_OFFSET) return null
  return encodeMarketplaceCursor(offset + limit)
}

export function decodeMarketplaceCursor(cursor?: string): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { o?: unknown }
    if (typeof parsed.o !== "number" || !Number.isFinite(parsed.o)) return 0
    return Math.min(MAX_MARKETPLACE_OFFSET, Math.max(0, Math.floor(parsed.o)))
  } catch {
    return 0
  }
}

export function encodeMarketplaceCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString(
    "base64url"
  )
}

const modePrice = sql<number>`coalesce(${main.eventTypeModes.priceCents}, ${main.eventTypes.priceAmount})`

function publishedEventType() {
  return and(
    eq(main.eventTypes.expertProfileId, main.expertProfiles.id),
    eq(main.eventTypes.active, true),
    eq(main.eventTypes.published, true),
    isNull(main.eventTypes.deletedAt)
  )
}

export async function listPublicMarketplaceExperts(
  input: ListMarketplaceExpertsInput = {}
): Promise<ListMarketplaceExpertsResult> {
  const limit = Math.min(50, Math.max(1, Math.floor(input.limit ?? 24)))
  const offset = decodeMarketplaceCursor(input.cursor)
  const sort = input.sort ?? "relevance"

  return withPlatformAdminContext(async (tx) => {
    const conditions = [
      eq(main.expertProfiles.status, "active"),
      isNull(main.expertProfiles.deletedAt),
    ]

    if (input.language) {
      conditions.push(
        sql`${main.expertProfiles.languages} && ARRAY[${input.language}]::text[]`
      )
    }

    if (input.category) {
      const matching = tx
        .select({ id: main.expertListings.expertProfileId })
        .from(main.expertListings)
        .innerJoin(
          main.expertCategories,
          eq(main.expertListings.categoryId, main.expertCategories.id)
        )
        .where(eq(main.expertCategories.slug, input.category))
      conditions.push(inArray(main.expertProfiles.id, matching))
    }

    if (input.minPrice != null || input.maxPrice != null) {
      const priceConditions = [publishedEventType()]
      if (input.minPrice != null) {
        priceConditions.push(sql`${modePrice} >= ${input.minPrice}`)
      }
      if (input.maxPrice != null) {
        priceConditions.push(sql`${modePrice} <= ${input.maxPrice}`)
      }
      conditions.push(
        exists(
          tx
            .select({ one: sql`1` })
            .from(main.eventTypes)
            .leftJoin(
              main.eventTypeModes,
              and(
                eq(main.eventTypeModes.eventTypeId, main.eventTypes.id),
                eq(main.eventTypeModes.active, true)
              )
            )
            .where(and(...priceConditions))
        )
      )
    }

    const where = and(...conditions)
    const priceByExpert = tx
      .select({
        expertProfileId: main.eventTypes.expertProfileId,
        minPriceCents: sql<number>`min(${modePrice})`.as("min_price_cents"),
      })
      .from(main.eventTypes)
      .leftJoin(
        main.eventTypeModes,
        and(
          eq(main.eventTypeModes.eventTypeId, main.eventTypes.id),
          eq(main.eventTypeModes.active, true)
        )
      )
      .where(
        and(
          eq(main.eventTypes.active, true),
          eq(main.eventTypes.published, true),
          isNull(main.eventTypes.deletedAt)
        )
      )
      .groupBy(main.eventTypes.expertProfileId)
      .as("expert_min_price")

    const orderBy =
      sort === "price"
        ? [
            asc(priceByExpert.minPriceCents),
            asc(main.expertProfiles.displayName),
            asc(main.expertProfiles.id),
          ]
        : sort === "rating"
          ? [
              desc(main.expertProfiles.topExpertActive),
              asc(main.expertProfiles.displayName),
              asc(main.expertProfiles.id),
            ]
          : [asc(main.expertProfiles.displayName), asc(main.expertProfiles.id)]

    const rows = await tx
      .select({
        id: main.expertProfiles.id,
        username: main.expertProfiles.username,
        displayName: main.expertProfiles.displayName,
        headline: main.expertProfiles.headline,
        avatarUrl: main.expertProfiles.avatarUrl,
        languages: main.expertProfiles.languages,
        serviceCountries: main.expertProfiles.serviceCountries,
        topExpertActive: main.expertProfiles.topExpertActive,
        minPriceCents: priceByExpert.minPriceCents,
      })
      .from(main.expertProfiles)
      .leftJoin(
        priceByExpert,
        eq(priceByExpert.expertProfileId, main.expertProfiles.id)
      )
      .where(where)
      .orderBy(...orderBy)
      .limit(limit + 1)
      .offset(offset)

    const page = rows.slice(0, limit)
    const expertIds = page.map((row) => row.id)
    const listingRows =
      expertIds.length === 0
        ? []
        : await tx
            .select({
              expertId: main.expertListings.expertProfileId,
              slug: main.expertCategories.slug,
            })
            .from(main.expertListings)
            .innerJoin(
              main.expertCategories,
              eq(main.expertListings.categoryId, main.expertCategories.id)
            )
            .where(inArray(main.expertListings.expertProfileId, expertIds))
            .orderBy(asc(main.expertListings.sortOrder))

    const slugsByExpert = new Map<string, string[]>()
    for (const listing of listingRows) {
      const existing = slugsByExpert.get(listing.expertId) ?? []
      existing.push(listing.slug)
      slugsByExpert.set(listing.expertId, existing)
    }

    return {
      experts: page.map((row) => ({
        username: row.username,
        displayName: row.displayName,
        headline: row.headline,
        avatarUrl: row.avatarUrl,
        languages: row.languages,
        serviceCountries: row.serviceCountries,
        categorySlugs: slugsByExpert.get(row.id) ?? [],
        minPriceCents:
          row.minPriceCents == null ? null : Number(row.minPriceCents),
        topExpertActive: row.topExpertActive,
      })),
      nextCursor: nextMarketplaceCursor(offset, limit, rows.length > limit),
    }
  })
}

export async function listPublicEventTypeModes(
  eventTypeIds: string[]
): Promise<Map<string, PublicEventTypeMode[]>> {
  const result = new Map<string, PublicEventTypeMode[]>()
  if (eventTypeIds.length === 0) return result

  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        eventTypeId: main.eventTypeModes.eventTypeId,
        id: main.eventTypeModes.id,
        mode: main.eventTypeModes.mode,
        priceCents: main.eventTypeModes.priceCents,
        durationMinutes: main.eventTypeModes.durationMinutes,
        countryScopeType: main.eventTypeModes.countryScopeType,
        countryScopeCodes: main.eventTypeModes.countryScopeCodes,
        languages: main.eventTypeModes.languages,
        label: main.eventTypeModes.label,
        eventPrice: main.eventTypes.priceAmount,
        eventDuration: main.eventTypes.durationMinutes,
        locationId: main.expertPracticeLocations.id,
        locationName: main.expertPracticeLocations.name,
        locationCity: main.expertPracticeLocations.city,
        locationCountry: main.expertPracticeLocations.country,
      })
      .from(main.eventTypeModes)
      .innerJoin(
        main.eventTypes,
        eq(main.eventTypes.id, main.eventTypeModes.eventTypeId)
      )
      .leftJoin(
        main.expertPracticeLocations,
        eq(main.expertPracticeLocations.id, main.eventTypeModes.locationId)
      )
      .where(
        and(
          inArray(main.eventTypeModes.eventTypeId, eventTypeIds),
          eq(main.eventTypeModes.active, true)
        )
      )
      .orderBy(
        asc(main.eventTypeModes.sortOrder),
        asc(main.eventTypeModes.mode)
      )

    for (const row of rows) {
      const modes = result.get(row.eventTypeId) ?? []
      modes.push({
        id: row.id,
        mode: row.mode,
        priceCents: row.priceCents ?? row.eventPrice,
        currency: "EUR",
        durationMinutes: row.durationMinutes ?? row.eventDuration,
        countryScopeType: row.countryScopeType,
        countryScopeCodes: row.countryScopeCodes,
        languages: row.languages,
        label: row.label,
        location:
          row.locationId &&
          row.locationName &&
          row.locationCity &&
          row.locationCountry
            ? {
                id: row.locationId,
                name: row.locationName,
                city: row.locationCity,
                country: row.locationCountry,
              }
            : null,
      })
      result.set(row.eventTypeId, modes)
    }

    return result
  })
}

export function isBookingLinkUsable(
  link: {
    revokedAt: Date | null
    expiresAt: Date
    useCount: number
    maxUses: number
  },
  now: Date
): boolean {
  if (link.revokedAt != null) return false
  if (link.expiresAt.getTime() <= now.getTime()) return false
  if (link.useCount >= link.maxUses) return false
  return true
}

export async function findUsableBookingLink(
  tokenHash: string
): Promise<PublicBookingLink | null> {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null

  const orgId = await withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ orgId: main.bookingLinks.orgId })
      .from(main.bookingLinks)
      .where(eq(main.bookingLinks.tokenHash, tokenHash))
      .limit(1)
    return row?.orgId ?? null
  })
  if (!orgId) return null

  return withOrgContext(orgId, async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.bookingLinks.orgId,
        eventTypeId: main.bookingLinks.eventTypeId,
        eventTypeModeId: main.bookingLinks.eventTypeModeId,
        scheduleId: main.bookingLinks.scheduleId,
        priceCents: main.bookingLinks.priceCents,
        expiresAt: main.bookingLinks.expiresAt,
        revokedAt: main.bookingLinks.revokedAt,
        useCount: main.bookingLinks.useCount,
        maxUses: main.bookingLinks.maxUses,
      })
      .from(main.bookingLinks)
      .where(
        and(
          eq(main.bookingLinks.tokenHash, tokenHash),
          eq(main.bookingLinks.orgId, orgId)
        )
      )
      .limit(1)

    if (!row || !isBookingLinkUsable(row, new Date())) return null

    return {
      orgId: row.orgId,
      eventTypeId: row.eventTypeId,
      eventTypeModeId: row.eventTypeModeId,
      scheduleId: row.scheduleId,
      priceCents: row.priceCents,
      expiresAt: row.expiresAt,
    }
  })
}
