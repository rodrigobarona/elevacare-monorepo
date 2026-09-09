import { createHash } from "node:crypto"
import { loadOfferForResolve } from "@eleva/db"
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
  recipientEmail?: string | null
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  active: boolean
  published: boolean
  bookingWindowDays: number | null
  minimumNoticeMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
}

export type ResolveOfferInput = {
  expertOrgId: string
  eventTypeModeId: string
  linkToken?: string
  viewerEmail?: string
  /** When true, a recipient-restricted link 404s unless viewerEmail matches. */
  enforceRecipient?: boolean
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
  published: boolean
  bookingWindowDays: number | null
  minimumNoticeMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
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
  recipientEmail: string | null
}

export function hashBookingLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function isUsableBookingLink(link: OfferLinkRow, now: Date): boolean {
  if (link.revokedAt !== null) return false
  if (link.expiresAt.getTime() <= now.getTime()) return false
  return link.useCount < link.maxUses
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function linkRecipientMatches(
  recipientEmail: string | null,
  viewerEmail: string
): boolean {
  if (recipientEmail === null) return true
  return normalizeEmail(recipientEmail) === normalizeEmail(viewerEmail)
}

export function composeResolvedOffer(input: {
  orgId: string
  mode: OfferModeRow
  eventType: OfferEventTypeRow
  link?: OfferLinkRow | null
  now?: Date
  viewerEmail?: string
  enforceRecipient?: boolean
}): ResolveOfferResult {
  const {
    orgId,
    mode,
    eventType,
    link,
    now = new Date(),
    viewerEmail,
    enforceRecipient,
  } = input
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
    if (
      enforceRecipient &&
      link.recipientEmail !== null &&
      (viewerEmail === undefined ||
        !linkRecipientMatches(link.recipientEmail, viewerEmail))
    ) {
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
      ...(link
        ? { bookingLinkId: link.id, recipientEmail: link.recipientEmail }
        : {}),
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      active: mode.active,
      published: eventType.published,
      bookingWindowDays: eventType.bookingWindowDays,
      minimumNoticeMinutes: eventType.minimumNoticeMinutes,
      bufferBeforeMinutes: eventType.bufferBeforeMinutes,
      bufferAfterMinutes: eventType.bufferAfterMinutes,
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
    viewerEmail: input.viewerEmail,
    enforceRecipient: input.enforceRecipient,
  })
}
