import { createHash } from "node:crypto"
import { isBookingLinkUsable, loadOfferForResolve } from "@eleva/db"
import type { CountryScopeType, OfferMode } from "./offer-invariants"

export type ResolvedOffer = {
  orgId: string
  eventTypeId: string
  eventTypeModeId: string
  expertProfileId: string
  mode: OfferMode
  scheduleId: string
  priceCents: number
  currency: "EUR"
  durationMinutes: number
  bookingLinkId?: string
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  active: boolean
}

export type ResolveOfferInput = {
  expertOrgId: string
  eventTypeModeId: string
  linkToken?: string
}

export type ResolveOfferResult =
  | { ok: true; offer: ResolvedOffer }
  | { ok: false; error: "not_found" }

export type OfferModeRow = {
  id: string
  orgId: string
  eventTypeId: string
  mode: OfferMode
  scheduleId: string
  priceCents: number | null
  durationMinutes: number | null
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  active: boolean
}

export type OfferEventTypeRow = {
  id: string
  expertProfileId: string
  durationMinutes: number
  priceAmount: number
}

export type OfferLinkRow = {
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

export function hashBookingLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function isUsableBookingLink(link: OfferLinkRow, now: Date): boolean {
  return isBookingLinkUsable(link, now)
}

export function composeResolvedOffer(input: {
  orgId: string
  mode: OfferModeRow
  eventType: OfferEventTypeRow
  link?: OfferLinkRow | null
  now?: Date
}): ResolveOfferResult {
  const { orgId, mode, eventType, link, now = new Date() } = input
  if (mode.orgId !== orgId || mode.eventTypeId !== eventType.id) {
    return { ok: false, error: "not_found" }
  }
  if (!mode.active) {
    return { ok: false, error: "not_found" }
  }

  if (link) {
    if (link.orgId !== orgId || link.eventTypeId !== eventType.id) {
      return { ok: false, error: "not_found" }
    }
    if (link.eventTypeModeId != null && link.eventTypeModeId !== mode.id) {
      return { ok: false, error: "not_found" }
    }
    if (!isUsableBookingLink(link, now)) {
      return { ok: false, error: "not_found" }
    }
  }

  return {
    ok: true,
    offer: {
      orgId,
      eventTypeId: eventType.id,
      eventTypeModeId: mode.id,
      expertProfileId: eventType.expertProfileId,
      mode: mode.mode,
      scheduleId: link?.scheduleId ?? mode.scheduleId,
      priceCents: link?.priceCents ?? mode.priceCents ?? eventType.priceAmount,
      currency: "EUR",
      durationMinutes: mode.durationMinutes ?? eventType.durationMinutes,
      ...(link ? { bookingLinkId: link.id } : {}),
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      active: mode.active,
    },
  }
}

export async function resolveOffer(
  input: ResolveOfferInput
): Promise<ResolveOfferResult> {
  const loaded = await loadOfferForResolve({
    expertOrgId: input.expertOrgId,
    eventTypeModeId: input.eventTypeModeId,
    tokenHash: input.linkToken
      ? hashBookingLinkToken(input.linkToken)
      : undefined,
  })
  if (!loaded) return { ok: false, error: "not_found" }

  return composeResolvedOffer({
    orgId: input.expertOrgId,
    mode: loaded.mode,
    eventType: loaded.eventType,
    link: loaded.link,
  })
}
