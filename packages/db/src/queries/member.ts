import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { user } from "../schema/auth"
import * as main from "../schema/main"
import type { LocalizedText } from "../schema/main/shared"
import {
  withPlatformAdminContext,
  withOrgContext,
  withUserContext,
  type Tx,
} from "../context"
import { updateUserAvatarUrl } from "./users"

const MEMBER_BOOKING_PAGE_SIZE = 20
const MEMBER_PAYMENT_PAGE_SIZE = 20
const MAX_MEMBER_PAGE_SIZE = 50

const UPCOMING_EXCLUDED_STATUSES = [
  "cancelled",
  "completed",
  "no_show",
  "refunded",
] as const

export type MemberProfile = {
  id: string
  email: string
  name: string
  timezone: string | null
  locale: string | null
  avatarUrl: string | null
}

export type MemberNotificationPreference = {
  channel: (typeof main.notificationChannelEnum.enumValues)[number]
  category: (typeof main.notificationCategoryEnum.enumValues)[number]
  enabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  timezone: string | null
}

export type MemberBookingListItem = {
  id: string
  orgId: string
  status: (typeof main.bookingStatusEnum.enumValues)[number]
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: main.SessionMode
  priceCents: number
  currency: string
  expert: { displayName: string; username: string }
  eventType: { slug: string; title: LocalizedText }
}

export type MemberPaymentListItem = {
  id: string
  orgId: string
  bookingId: string
  status: (typeof main.bookingPaymentStatusEnum.enumValues)[number]
  amountCents: number
  currency: string
  paidAt: Date | null
  refundedCents: number
  receiptUrl: string | null
  stripeChargeId: string | null
  stripePaymentIntentId: string | null
}

export type MemberListResult<T> = {
  items: T[]
  nextCursor: string | null
}

export async function getMemberProfile(
  userId: string
): Promise<MemberProfile | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        locale: user.locale,
        avatarUrl: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    return row ?? null
  })
}

export async function updateMemberProfileRow(
  tx: Tx,
  input: {
    userId: string
    actorUserId: string
    name?: string
    timezone?: string | null
    locale?: string | null
    avatarUrl?: string | null
  }
): Promise<MemberProfile | null> {
  if (input.avatarUrl !== undefined) {
    await updateUserAvatarUrl(
      input.userId,
      input.avatarUrl,
      input.actorUserId,
      tx
    )
  }

  const patch: {
    name?: string
    timezone?: string | null
    locale?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.locale !== undefined) patch.locale = input.locale

  const [row] = await tx
    .update(user)
    .set(patch)
    .where(eq(user.id, input.userId))
    .returning({
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      locale: user.locale,
      avatarUrl: user.image,
    })
  return row ?? null
}

export async function listMemberNotificationPreferences(
  userId: string
): Promise<MemberNotificationPreference[]> {
  return withUserContext(userId, (tx) => listPreferencesInTx(tx, userId))
}

export async function upsertMemberNotificationPreferencesInTx(
  tx: Tx,
  input: {
    userId: string
    timezone?: string | null
    quietHoursStart?: string | null
    quietHoursEnd?: string | null
    preferences: Array<{
      channel: MemberNotificationPreference["channel"]
      category: MemberNotificationPreference["category"]
      enabled: boolean
    }>
  }
): Promise<MemberNotificationPreference[]> {
  const now = new Date()
  const existing = await listPreferencesInTx(tx, input.userId)
  const seed = existing[0]
  const timezone =
    input.timezone !== undefined ? input.timezone : (seed?.timezone ?? null)
  const quietHoursStart =
    input.quietHoursStart !== undefined
      ? input.quietHoursStart
      : (seed?.quietHoursStart ?? null)
  const quietHoursEnd =
    input.quietHoursEnd !== undefined
      ? input.quietHoursEnd
      : (seed?.quietHoursEnd ?? null)

  for (const preference of input.preferences) {
    const set: {
      enabled: boolean
      updatedAt: Date
      quietHoursStart?: string | null
      quietHoursEnd?: string | null
      timezone?: string | null
    } = {
      enabled: preference.enabled,
      updatedAt: now,
    }
    if (input.quietHoursStart !== undefined) {
      set.quietHoursStart = input.quietHoursStart
    }
    if (input.quietHoursEnd !== undefined) {
      set.quietHoursEnd = input.quietHoursEnd
    }
    if (input.timezone !== undefined) {
      set.timezone = input.timezone
    }
    await tx
      .insert(main.notificationPreferences)
      .values({
        userId: input.userId,
        channel: preference.channel,
        category: preference.category,
        enabled: preference.enabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          main.notificationPreferences.userId,
          main.notificationPreferences.channel,
          main.notificationPreferences.category,
        ],
        set,
      })
  }

  const memberLevel: {
    updatedAt: Date
    quietHoursStart?: string | null
    quietHoursEnd?: string | null
    timezone?: string | null
  } = { updatedAt: now }
  if (input.quietHoursStart !== undefined) {
    memberLevel.quietHoursStart = input.quietHoursStart
  }
  if (input.quietHoursEnd !== undefined) {
    memberLevel.quietHoursEnd = input.quietHoursEnd
  }
  if (input.timezone !== undefined) {
    memberLevel.timezone = input.timezone
  }
  if (
    input.timezone !== undefined ||
    input.quietHoursStart !== undefined ||
    input.quietHoursEnd !== undefined
  ) {
    await tx
      .update(main.notificationPreferences)
      .set(memberLevel)
      .where(eq(main.notificationPreferences.userId, input.userId))
  }

  return listPreferencesInTx(tx, input.userId)
}

async function listPreferencesInTx(
  tx: Tx,
  userId: string
): Promise<MemberNotificationPreference[]> {
  const rows = await tx
    .select({
      channel: main.notificationPreferences.channel,
      category: main.notificationPreferences.category,
      enabled: main.notificationPreferences.enabled,
      quietHoursStart: main.notificationPreferences.quietHoursStart,
      quietHoursEnd: main.notificationPreferences.quietHoursEnd,
      timezone: main.notificationPreferences.timezone,
    })
    .from(main.notificationPreferences)
    .where(eq(main.notificationPreferences.userId, userId))
    .orderBy(
      asc(main.notificationPreferences.channel),
      asc(main.notificationPreferences.category)
    )
  return rows.map((row) => ({
    channel: row.channel,
    category: row.category,
    enabled: row.enabled,
    quietHoursStart: formatTime(row.quietHoursStart),
    quietHoursEnd: formatTime(row.quietHoursEnd),
    timezone: row.timezone,
  }))
}

export async function listMemberBookings(input: {
  userId: string
  orgId: string
  range: "upcoming" | "past"
  cursor?: string
  limit?: number
}): Promise<MemberListResult<MemberBookingListItem>> {
  const limit = clampPageSize(input.limit, MEMBER_BOOKING_PAGE_SIZE)
  const cursor = decodeMemberCursor(input.cursor)
  const now = new Date()

  const rows = await withOrgContext(input.orgId, async (tx) => {
    const conditions = [
      eq(main.bookings.memberUserId, input.userId),
      or(
        eq(main.bookings.orgId, input.orgId),
        eq(main.bookings.counterpartyOrgId, input.orgId)
      )!,
    ]
    if (input.range === "upcoming") {
      conditions.push(sql`${main.bookings.startsAt} >= ${now}`)
      conditions.push(
        notInArray(main.bookings.status, [...UPCOMING_EXCLUDED_STATUSES])
      )
      if (cursor) {
        conditions.push(
          or(
            gt(main.bookings.startsAt, cursor.at),
            and(
              eq(main.bookings.startsAt, cursor.at),
              gt(main.bookings.id, cursor.id)
            )
          )!
        )
      }
    } else {
      conditions.push(
        or(
          lt(main.bookings.startsAt, now),
          inArray(main.bookings.status, [...UPCOMING_EXCLUDED_STATUSES])
        )!
      )
      if (cursor) {
        conditions.push(
          or(
            lt(main.bookings.startsAt, cursor.at),
            and(
              eq(main.bookings.startsAt, cursor.at),
              lt(main.bookings.id, cursor.id)
            )
          )!
        )
      }
    }

    const order =
      input.range === "upcoming"
        ? [asc(main.bookings.startsAt), asc(main.bookings.id)]
        : [desc(main.bookings.startsAt), desc(main.bookings.id)]

    return tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        status: main.bookings.status,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        timezone: main.bookings.timezone,
        sessionMode: main.bookings.sessionMode,
        priceCents: main.bookings.priceCents,
        currency: main.bookings.currency,
      })
      .from(main.bookings)
      .where(and(...conditions))
      .orderBy(...order)
      .limit(limit + 1)
  })

  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const detailsById = await loadMemberBookingDetails(page)

  return {
    items: page.flatMap((row) => {
      const details = detailsById.get(row.id)
      if (!details) return []
      return [
        {
          id: row.id,
          orgId: row.orgId,
          status: row.status,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          timezone: row.timezone,
          sessionMode: row.sessionMode,
          priceCents: row.priceCents,
          currency: row.currency,
          expert: {
            displayName: details.displayName,
            username: details.username,
          },
          eventType: { slug: details.slug, title: details.title },
        },
      ]
    }),
    nextCursor:
      rows.length > limit && last
        ? encodeMemberCursor(last.startsAt, last.id)
        : null,
  }
}

async function loadMemberBookingDetails(
  page: Array<{ id: string; orgId: string }>
): Promise<
  Map<
    string,
    {
      displayName: string
      username: string
      slug: string
      title: LocalizedText
    }
  >
> {
  const detailsById = new Map<
    string,
    {
      displayName: string
      username: string
      slug: string
      title: LocalizedText
    }
  >()
  if (page.length === 0) return detailsById

  const idsByOrg = new Map<string, string[]>()
  for (const row of page) {
    const ids = idsByOrg.get(row.orgId) ?? []
    ids.push(row.id)
    idsByOrg.set(row.orgId, ids)
  }

  await Promise.all(
    [...idsByOrg.entries()].map(async ([expertOrgId, ids]) => {
      const details = await withOrgContext(expertOrgId, async (tx) =>
        tx
          .select({
            id: main.bookings.id,
            displayName: main.expertProfiles.displayName,
            username: main.expertProfiles.username,
            slug: main.eventTypes.slug,
            title: main.eventTypes.title,
          })
          .from(main.bookings)
          .innerJoin(
            main.expertProfiles,
            eq(main.expertProfiles.id, main.bookings.expertProfileId)
          )
          .innerJoin(
            main.eventTypes,
            eq(main.eventTypes.id, main.bookings.eventTypeId)
          )
          .where(inArray(main.bookings.id, ids))
      )
      for (const row of details) {
        detailsById.set(row.id, {
          displayName: row.displayName,
          username: row.username,
          slug: row.slug,
          title: row.title,
        })
      }
    })
  )

  return detailsById
}

export async function listMemberPayments(input: {
  userId: string
  cursor?: string
  limit?: number
}): Promise<MemberListResult<MemberPaymentListItem>> {
  const limit = clampPageSize(input.limit, MEMBER_PAYMENT_PAGE_SIZE)
  const cursor = decodeMemberCursor(input.cursor)

  return withPlatformAdminContext(async (tx) => {
    const conditions = [eq(main.bookings.memberUserId, input.userId)]
    if (cursor) {
      conditions.push(
        or(
          lt(main.bookingPayments.createdAt, cursor.at),
          and(
            eq(main.bookingPayments.createdAt, cursor.at),
            lt(main.bookingPayments.id, cursor.id)
          )
        )!
      )
    }

    const rows = await tx
      .select({
        id: main.bookingPayments.id,
        orgId: main.bookingPayments.orgId,
        bookingId: main.bookingPayments.bookingId,
        status: main.bookingPayments.status,
        amountCents: main.bookingPayments.amountCents,
        currency: main.bookings.currency,
        paidAt: main.bookingPayments.paidAt,
        refundedCents: main.bookingPayments.refundedCents,
        receiptUrl: main.bookingPayments.receiptUrl,
        stripeChargeId: main.bookingPayments.stripeChargeId,
        stripePaymentIntentId: main.bookingPayments.stripePaymentIntentId,
        createdAt: main.bookingPayments.createdAt,
      })
      .from(main.bookingPayments)
      .innerJoin(
        main.bookings,
        eq(main.bookings.id, main.bookingPayments.bookingId)
      )
      .where(and(...conditions))
      .orderBy(
        desc(main.bookingPayments.createdAt),
        desc(main.bookingPayments.id)
      )
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const last = page[page.length - 1]
    return {
      items: page.map((row) => ({
        id: row.id,
        orgId: row.orgId,
        bookingId: row.bookingId,
        status: row.status,
        amountCents: row.amountCents,
        currency: row.currency,
        paidAt: row.paidAt,
        refundedCents: row.refundedCents,
        receiptUrl: row.receiptUrl,
        stripeChargeId: row.stripeChargeId,
        stripePaymentIntentId: row.stripePaymentIntentId,
      })),
      nextCursor:
        rows.length > limit && last
          ? encodeMemberCursor(last.createdAt, last.id)
          : null,
    }
  })
}

export async function cacheBookingPaymentReceipt(
  tx: Tx,
  input: {
    paymentId: string
    receiptUrl: string
    stripeChargeId?: string | null
  }
): Promise<void> {
  await tx
    .update(main.bookingPayments)
    .set({
      receiptUrl: input.receiptUrl,
      ...(input.stripeChargeId ? { stripeChargeId: input.stripeChargeId } : {}),
    })
    .where(eq(main.bookingPayments.id, input.paymentId))
}

export async function lockMemberHealthConsentInvariant(
  tx: Tx,
  userId: string
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`)
}

export type MemberBookingPolicyRow = {
  id: string
  orgId: string
  status: (typeof main.bookingStatusEnum.enumValues)[number]
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: main.SessionMode
  bookedLocale: string | null
  memberEmail: string | null
  memberName: string | null
  guestEmail: string | null
  guestName: string | null
  expertUserId: string
  expertEmail: string
  expertName: string
  eventTypeName: { en: string; pt?: string; es?: string }
  paymentId: string | null
  paymentStatus:
    | (typeof main.bookingPaymentStatusEnum.enumValues)[number]
    | null
  expertProfileId: string
  reservationId: string | null
  eventTypeModeId: string | null
}

export async function getMemberBookingForPolicy(input: {
  userId: string
  bookingId: string
  orgId: string
}): Promise<MemberBookingPolicyRow | null> {
  const expertOrgId = await withOrgContext(input.orgId, async (tx) => {
    const [row] = await tx
      .select({ orgId: main.bookings.orgId })
      .from(main.bookings)
      .where(
        and(
          eq(main.bookings.id, input.bookingId),
          eq(main.bookings.memberUserId, input.userId),
          or(
            eq(main.bookings.orgId, input.orgId),
            eq(main.bookings.counterpartyOrgId, input.orgId)
          )
        )
      )
      .limit(1)
    return row?.orgId ?? null
  })
  if (!expertOrgId) return null

  const expertUser = alias(user, "expert_user")
  return withOrgContext(expertOrgId, async (tx) => {
    const [row] = await tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        status: main.bookings.status,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        timezone: main.bookings.timezone,
        sessionMode: main.bookings.sessionMode,
        bookedLocale: main.bookings.bookedLocale,
        memberEmail: user.email,
        memberName: user.name,
        guestEmail: main.bookings.guestEmail,
        guestName: main.bookings.guestName,
        expertUserId: main.bookings.expertUserId,
        expertEmail: expertUser.email,
        expertName: expertUser.name,
        eventTypeName: main.eventTypes.title,
        paymentId: main.bookingPayments.id,
        paymentStatus: main.bookingPayments.status,
        expertProfileId: main.bookings.expertProfileId,
        reservationId: main.bookings.reservationId,
        eventTypeModeId: main.bookings.eventTypeModeId,
      })
      .from(main.bookings)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.bookings.expertProfileId)
      )
      .innerJoin(
        main.eventTypes,
        eq(main.eventTypes.id, main.bookings.eventTypeId)
      )
      .innerJoin(expertUser, eq(expertUser.id, main.bookings.expertUserId))
      .leftJoin(user, eq(user.id, main.bookings.memberUserId))
      .leftJoin(
        main.bookingPayments,
        eq(main.bookingPayments.bookingId, main.bookings.id)
      )
      .where(
        and(
          eq(main.bookings.id, input.bookingId),
          eq(main.bookings.memberUserId, input.userId),
          eq(main.bookings.orgId, expertOrgId)
        )
      )
      .limit(1)
    return row ?? null
  })
}

export async function memberHasConfirmedFutureBooking(
  userId: string,
  now: Date = new Date(),
  tx?: Tx
): Promise<boolean> {
  const run = async (handle: Tx) => {
    const [row] = await handle
      .select({ id: main.bookings.id })
      .from(main.bookings)
      .where(
        and(
          eq(main.bookings.memberUserId, userId),
          eq(main.bookings.status, "confirmed"),
          gt(main.bookings.startsAt, now)
        )
      )
      .limit(1)
    return Boolean(row)
  }
  if (tx) return run(tx)
  return withPlatformAdminContext(run)
}

function clampPageSize(limit: number | undefined, fallback: number): number {
  if (limit == null || !Number.isFinite(limit)) return fallback
  return Math.min(MAX_MEMBER_PAGE_SIZE, Math.max(1, Math.floor(limit)))
}

function encodeMemberCursor(at: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: at.toISOString(), id }),
    "utf8"
  ).toString("base64url")
}

function decodeMemberCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { t?: unknown; id?: unknown }
    if (typeof parsed.t !== "string" || typeof parsed.id !== "string") {
      return null
    }
    const at = new Date(parsed.t)
    if (Number.isNaN(at.getTime())) return null
    return { at, id: parsed.id }
  } catch {
    return null
  }
}

function formatTime(value: string | null): string | null {
  if (!value) return null
  return value.length >= 5 ? value.slice(0, 5) : value
}
