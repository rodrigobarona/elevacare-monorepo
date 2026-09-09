import { and, eq, isNull } from "drizzle-orm"
import { withOrgContext } from "../context"
import { bookingLinks, eventTypeModes, eventTypes } from "../schema/main"

export type OfferResolveModeRow = {
  id: string
  orgId: string
  eventTypeId: string
  mode: (typeof eventTypeModes.$inferSelect)["mode"]
  scheduleId: string
  priceCents: number | null
  durationMinutes: number | null
  countryScopeType: (typeof eventTypeModes.$inferSelect)["countryScopeType"]
  countryScopeCodes: string[]
  languages: string[]
  active: boolean
}

export type OfferResolveEventTypeRow = {
  id: string
  expertProfileId: string
  durationMinutes: number
  priceAmount: number
}

export type OfferResolveLinkRow = {
  id: string
  orgId: string
  eventTypeId: string
  eventTypeModeId: string | null
  scheduleId: string | null
  priceCents: number | null
  revokedAt: Date | null
  expiresAt: Date
  useCount: number
  maxUses: number
}

export async function loadOfferForResolve(input: {
  expertOrgId: string
  eventTypeModeId: string
  tokenHash?: string
}): Promise<{
  mode: OfferResolveModeRow
  eventType: OfferResolveEventTypeRow
  link: OfferResolveLinkRow | null
} | null> {
  return withOrgContext(input.expertOrgId, async (tx) => {
    const [mode] = await tx
      .select({
        id: eventTypeModes.id,
        orgId: eventTypeModes.orgId,
        eventTypeId: eventTypeModes.eventTypeId,
        mode: eventTypeModes.mode,
        scheduleId: eventTypeModes.scheduleId,
        priceCents: eventTypeModes.priceCents,
        durationMinutes: eventTypeModes.durationMinutes,
        countryScopeType: eventTypeModes.countryScopeType,
        countryScopeCodes: eventTypeModes.countryScopeCodes,
        languages: eventTypeModes.languages,
        active: eventTypeModes.active,
      })
      .from(eventTypeModes)
      .where(
        and(
          eq(eventTypeModes.id, input.eventTypeModeId),
          eq(eventTypeModes.orgId, input.expertOrgId)
        )
      )
      .limit(1)

    if (!mode) return null

    const [eventType] = await tx
      .select({
        id: eventTypes.id,
        expertProfileId: eventTypes.expertProfileId,
        durationMinutes: eventTypes.durationMinutes,
        priceAmount: eventTypes.priceAmount,
      })
      .from(eventTypes)
      .where(
        and(
          eq(eventTypes.id, mode.eventTypeId),
          eq(eventTypes.orgId, input.expertOrgId),
          isNull(eventTypes.deletedAt)
        )
      )
      .limit(1)

    if (!eventType) return null

    if (!input.tokenHash) {
      return { mode, eventType, link: null }
    }

    const [link] = await tx
      .select({
        id: bookingLinks.id,
        orgId: bookingLinks.orgId,
        eventTypeId: bookingLinks.eventTypeId,
        eventTypeModeId: bookingLinks.eventTypeModeId,
        scheduleId: bookingLinks.scheduleId,
        priceCents: bookingLinks.priceCents,
        revokedAt: bookingLinks.revokedAt,
        expiresAt: bookingLinks.expiresAt,
        useCount: bookingLinks.useCount,
        maxUses: bookingLinks.maxUses,
      })
      .from(bookingLinks)
      .where(
        and(
          eq(bookingLinks.tokenHash, input.tokenHash),
          eq(bookingLinks.orgId, input.expertOrgId)
        )
      )
      .limit(1)

    if (!link) return null
    return { mode, eventType, link }
  })
}
