import { randomBytes } from "node:crypto"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import type { Redis } from "@upstash/redis"
import {
  FUNNEL_CONSENT_KINDS,
  hashGuestEmail,
  validateFunnelConsents,
  type FunnelConsentKind,
} from "@eleva/compliance"
import {
  findExpertByUsername,
  getScheduleForBooking,
  listExpertBusyBookings,
} from "@eleva/db"
import type { Tx } from "@eleva/db/context"
import { bookingLinks, consents } from "@eleva/db/schema"
import { assertRequestedSlotAvailable } from "./assert-slot-available"
import { assertModeBookable } from "./mode-bookable"
import {
  linkRecipientMatches,
  normalizeEmail,
  resolveOffer,
} from "./resolve-offer"
import { LinkClaimError, reserveSlot } from "./reserve-slot"

export const RESERVE_TTL_SECONDS = 300

const E164_PHONE = /^\+[1-9]\d{6,14}$/

export type ReserveBookingGuest = {
  email: string
  name: string
  phone?: string
}

export type ReserveBookingSession = {
  userId: string
  email: string
}

export type ReserveBookingInput = {
  username: string
  eventTypeModeId: string
  startsAt: Date
  endsAt: Date
  timezone: string
  language: string
  memberCountry: string
  linkToken?: string
  guest?: ReserveBookingGuest
  session?: ReserveBookingSession
  phone?: string
  consents: { kind: string; version: string }[]
}

export type ReserveBookingError =
  | "not_found"
  | "CONSENT_VERSION_OUTDATED"
  | "MODE_NOT_AVAILABLE_IN_COUNTRY"
  | "MODE_LANGUAGE_MISMATCH"
  | "PHONE_REQUIRED"
  | "GUEST_REQUIRED"
  | "SLOT_UNAVAILABLE"
  | "SLOT_TAKEN"
  | "db_error"

export type ReserveBookingResult =
  | {
      ok: true
      reservationId: string
      reservationToken: string
      expiresAt: Date
    }
  | { ok: false; error: ReserveBookingError }

export function isE164Phone(phone: string): boolean {
  return E164_PHONE.test(phone)
}

export async function claimBookingLink(
  tx: Tx,
  input: { linkId: string; recipientEmail: string }
): Promise<void> {
  const now = new Date()
  const email = normalizeEmail(input.recipientEmail)
  const [row] = await tx
    .update(bookingLinks)
    .set({ useCount: sql`${bookingLinks.useCount} + 1` })
    .where(
      and(
        eq(bookingLinks.id, input.linkId),
        isNull(bookingLinks.revokedAt),
        sql`${bookingLinks.expiresAt} > ${now}`,
        sql`${bookingLinks.useCount} < ${bookingLinks.maxUses}`,
        or(
          isNull(bookingLinks.recipientEmail),
          sql`lower(${bookingLinks.recipientEmail}) = ${email}`
        )
      )
    )
    .returning({ id: bookingLinks.id })

  if (!row) {
    throw new LinkClaimError()
  }
}

export async function insertFunnelConsents(
  tx: Tx,
  input: {
    orgId: string
    reservationId: string
    locale: string
    grants: { kind: string; version: string }[]
    userId?: string
    guestEmail?: string
  }
): Promise<void> {
  const consentCheck = validateFunnelConsents(input.grants)
  if (!consentCheck.ok) {
    throw new Error(`invalid consent grants: ${consentCheck.error}`)
  }
  const byKind = new Map(
    input.grants.map((grant) => [grant.kind, grant.version])
  )

  let subject:
    | { subjectKind: "user"; userId: string }
    | { subjectKind: "guest"; guestEmailHash: string }
  if (input.userId !== undefined) {
    subject = { subjectKind: "user", userId: input.userId }
  } else {
    if (!input.guestEmail) {
      throw new Error("guestEmail is required for guest consents")
    }
    subject = {
      subjectKind: "guest",
      guestEmailHash: hashGuestEmail(input.guestEmail),
    }
  }

  await tx.insert(consents).values(
    FUNNEL_CONSENT_KINDS.map((kind: FunnelConsentKind) => ({
      orgId: input.orgId,
      ...subject,
      kind,
      documentVersion: byKind.get(kind) as string,
      locale: input.locale,
      source: "funnel" as const,
      reservationId: input.reservationId,
    }))
  )
}

/**
 * Public booking reserve: consents and mode gates run before the Redis
 * lock. A private link is claimed in the same transaction as the hold.
 */
export async function reserveBooking(
  redis: Redis,
  input: ReserveBookingInput
): Promise<ReserveBookingResult> {
  const consentCheck = validateFunnelConsents(input.consents)
  if (!consentCheck.ok) {
    return { ok: false, error: consentCheck.error }
  }

  const memberEmail = input.session?.email ?? input.guest?.email
  if (!memberEmail) {
    return { ok: false, error: "GUEST_REQUIRED" }
  }

  const expert = await findExpertByUsername(input.username)
  if (!expert) {
    return { ok: false, error: "not_found" }
  }

  const resolved = await resolveOffer({
    expertOrgId: expert.orgId,
    eventTypeModeId: input.eventTypeModeId,
    linkToken: input.linkToken,
    viewerEmail: memberEmail,
    enforceRecipient: true,
  })
  if (!resolved.ok) {
    return { ok: false, error: "not_found" }
  }

  const { offer } = resolved
  if (
    offer.recipientEmail &&
    !linkRecipientMatches(offer.recipientEmail, memberEmail)
  ) {
    return { ok: false, error: "not_found" }
  }

  const bookable = assertModeBookable({
    active: offer.active,
    countryScopeType: offer.countryScopeType,
    countryScopeCodes: offer.countryScopeCodes,
    languages: offer.languages,
    memberCountry: input.memberCountry,
    language: input.language,
  })
  if (!bookable.ok) {
    if (bookable.error === "MODE_INACTIVE") {
      return { ok: false, error: "not_found" }
    }
    return { ok: false, error: bookable.error }
  }

  const memberPhone = input.guest?.phone ?? input.phone
  if (offer.mode === "phone" && !isE164Phone(memberPhone ?? "")) {
    return { ok: false, error: "PHONE_REQUIRED" }
  }

  if (!offer.published && !offer.bookingLinkId) {
    return { ok: false, error: "not_found" }
  }

  const schedulePromise = getScheduleForBooking(expert.orgId, offer.scheduleId)
  const busyPromise = listExpertBusyBookings(
    expert.id,
    input.startsAt,
    input.endsAt
  )
  const [{ schedule, rules, overrides }, existingBookings] = await Promise.all([
    schedulePromise,
    busyPromise,
  ])
  if (!schedule) {
    return { ok: false, error: "not_found" }
  }
  const slotOk = assertRequestedSlotAvailable({
    offer,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    schedule,
    rules,
    overrides,
    existingBookings,
  })
  if (!slotOk.ok) {
    return slotOk
  }

  const holdToken = randomBytes(32).toString("hex")
  const funnelGuest =
    !input.session && input.guest
      ? {
          email: input.guest.email,
          name: input.guest.name,
          ...(memberPhone ? { phone: memberPhone } : {}),
        }
      : undefined
  const reserved = await reserveSlot(redis, {
    eventTypeId: offer.eventTypeId,
    expertProfileId: expert.id,
    expertUserId: expert.userId,
    orgId: expert.orgId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    holdToken,
    ttlSeconds: RESERVE_TTL_SECONDS,
    userId: input.session?.userId,
    eventTypeModeId: offer.eventTypeModeId,
    price: { cents: offer.priceCents, currency: offer.currency },
    funnel: {
      timezone: input.timezone,
      language: input.language,
      memberCountry: input.memberCountry,
      bookingLinkId: offer.bookingLinkId ?? null,
      sessionMode: offer.mode,
      ...(funnelGuest ? { guest: funnelGuest } : {}),
    },
    audit: {
      actorUserId: input.session?.userId ?? null,
      payload: {
        language: input.language,
        memberCountry: input.memberCountry,
        timezone: input.timezone,
        bookingLinkId: offer.bookingLinkId ?? null,
        consents: input.consents.map((grant) => ({
          kind: grant.kind,
          version: grant.version,
        })),
      },
    },
    afterInsert: async (tx, reservationId) => {
      if (offer.bookingLinkId) {
        await claimBookingLink(tx, {
          linkId: offer.bookingLinkId,
          recipientEmail: memberEmail,
        })
      }
      await insertFunnelConsents(tx, {
        orgId: expert.orgId,
        reservationId,
        locale: input.language,
        grants: input.consents,
        userId: input.session?.userId,
        guestEmail: input.session ? undefined : memberEmail,
      })
    },
  })

  if (!reserved.success) {
    if (reserved.error === "link_unusable") {
      return { ok: false, error: "not_found" }
    }
    if (reserved.error === "slot_taken" || reserved.error === "conflict") {
      return { ok: false, error: "SLOT_TAKEN" }
    }
    return { ok: false, error: "db_error" }
  }

  return {
    ok: true,
    reservationId: reserved.reservationId,
    reservationToken: reserved.reservationToken,
    expiresAt: new Date(Date.now() + RESERVE_TTL_SECONDS * 1000),
  }
}
