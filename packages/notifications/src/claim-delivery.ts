import { and, eq, isNull, lt, or, sql } from "drizzle-orm"
import { auth, main, withPlatformAdminContext, type Tx } from "@eleva/db"
import type { NotificationChannel } from "./channels"
import type { NotificationKind } from "./kinds"
import { pickUniqueEmailMatch } from "./unique-email-match"

export type DeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed"

export const LEASE_TTL_MS = 60_000
export const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000

export const TERMINAL_DELIVERY_STATUSES = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "suppressed",
] as const

export type DeliveryRow = {
  id: string
  orgId: string | null
  idempotencyKey: string
  kind: NotificationKind
  userId: string | null
  recipientEmail: string | null
  channel: NotificationChannel
  status: DeliveryStatus
  providerId: string | null
  leaseOwner: string
  claimedAt: Date
  firstAttemptAt: Date | null
  smsBodyHash: string | null
  error: string | null
}

export type ClaimInput = {
  runId: string
  now: Date
  orgId: string | null
  idempotencyKey: string
  kind: NotificationKind
  userId: string | null
  recipientEmail: string | null
  channel: NotificationChannel
}

export type ClaimOutcome =
  | { outcome: "claimed"; row: DeliveryRow }
  | { outcome: "held"; row: DeliveryRow }
  | { outcome: "already_complete"; row: DeliveryRow }

function isTerminal(
  status: DeliveryStatus
): status is (typeof TERMINAL_DELIVERY_STATUSES)[number] {
  return (TERMINAL_DELIVERY_STATUSES as readonly string[]).includes(status)
}

function toRow(
  row: typeof main.notificationDeliveries.$inferSelect
): DeliveryRow {
  return {
    id: row.id,
    orgId: row.orgId,
    idempotencyKey: row.idempotencyKey,
    kind: row.kind as NotificationKind,
    userId: row.userId,
    recipientEmail: row.recipientEmail,
    channel: row.channel,
    status: row.status,
    providerId: row.providerId,
    leaseOwner: row.leaseOwner,
    claimedAt: row.claimedAt,
    firstAttemptAt: row.firstAttemptAt,
    smsBodyHash: row.smsBodyHash,
    error: row.error,
  }
}

function recipientWhere(input: {
  userId: string | null
  recipientEmail: string | null
}) {
  if (input.userId) {
    return eq(main.notificationDeliveries.userId, input.userId)
  }
  return sql`lower(${main.notificationDeliveries.recipientEmail}::text) = ${input.recipientEmail?.toLowerCase() ?? ""}`
}

export async function claimDelivery(input: ClaimInput): Promise<ClaimOutcome> {
  const id = crypto.randomUUID()
  return withPlatformAdminContext(async (tx) => {
    const inserted = await tx
      .insert(main.notificationDeliveries)
      .values({
        id,
        orgId: input.orgId,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        channel: input.channel,
        status: "queued",
        leaseOwner: input.runId,
        claimedAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoNothing()
      .returning()

    const created = inserted[0]
    if (created) return { outcome: "claimed", row: toRow(created) }

    const existing = await loadExisting(tx, input)
    if (!existing) {
      throw new Error("claimDelivery: conflict without existing row")
    }
    if (isTerminal(existing.status)) {
      return { outcome: "already_complete", row: existing }
    }
    const staleBefore = new Date(input.now.getTime() - LEASE_TTL_MS)
    if (existing.claimedAt >= staleBefore) {
      return { outcome: "held", row: existing }
    }

    const reclaimed = await tx
      .update(main.notificationDeliveries)
      .set({
        leaseOwner: input.runId,
        claimedAt: input.now,
        status: "queued",
        error: null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(main.notificationDeliveries.id, existing.id),
          or(
            eq(main.notificationDeliveries.status, "queued"),
            eq(main.notificationDeliveries.status, "failed")
          ),
          lt(main.notificationDeliveries.claimedAt, staleBefore)
        )
      )
      .returning()

    const next = reclaimed[0]
    if (!next) return { outcome: "held", row: existing }
    return { outcome: "claimed", row: toRow(next) }
  })
}

async function loadExisting(
  tx: Tx,
  input: Pick<
    ClaimInput,
    "idempotencyKey" | "channel" | "userId" | "recipientEmail"
  >
): Promise<DeliveryRow | null> {
  const [row] = await tx
    .select()
    .from(main.notificationDeliveries)
    .where(
      and(
        eq(main.notificationDeliveries.idempotencyKey, input.idempotencyKey),
        eq(main.notificationDeliveries.channel, input.channel),
        recipientWhere(input)
      )
    )
    .limit(1)
  return row ? toRow(row) : null
}

export async function markFirstAttempt(input: {
  id: string
  runId: string
  now: Date
}): Promise<Date> {
  return withPlatformAdminContext(async (tx) => {
    const updated = await tx
      .update(main.notificationDeliveries)
      .set({ firstAttemptAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(main.notificationDeliveries.id, input.id),
          eq(main.notificationDeliveries.leaseOwner, input.runId),
          isNull(main.notificationDeliveries.firstAttemptAt)
        )
      )
      .returning({ firstAttemptAt: main.notificationDeliveries.firstAttemptAt })

    const written = updated[0]?.firstAttemptAt
    if (written) return written

    const [row] = await tx
      .select({
        firstAttemptAt: main.notificationDeliveries.firstAttemptAt,
      })
      .from(main.notificationDeliveries)
      .where(eq(main.notificationDeliveries.id, input.id))
      .limit(1)
    return row?.firstAttemptAt ?? input.now
  })
}

export async function persistSmsBodyHash(input: {
  id: string
  smsBodyHash: string
  now: Date
}): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.notificationDeliveries)
      .set({
        smsBodyHash: input.smsBodyHash,
        updatedAt: input.now,
      })
      .where(eq(main.notificationDeliveries.id, input.id))
  })
}

export async function completeSmsFromCallbackInTx(
  tx: Tx,
  input: {
    id: string
    providerId: string
    status: Extract<DeliveryStatus, "sent" | "failed" | "delivered">
    error?: string | null
    now: Date
  }
): Promise<boolean> {
  const updated = await tx
    .update(main.notificationDeliveries)
    .set({
      status: input.status,
      providerId: input.providerId,
      error: input.error ?? null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(main.notificationDeliveries.id, input.id),
        eq(main.notificationDeliveries.channel, "sms"),
        or(
          eq(main.notificationDeliveries.status, "queued"),
          eq(main.notificationDeliveries.status, "failed"),
          eq(main.notificationDeliveries.status, "sent")
        )
      )
    )
    .returning({ id: main.notificationDeliveries.id })
  return Boolean(updated[0])
}

export async function completeSmsFromCallback(input: {
  id: string
  providerId: string
  status: Extract<DeliveryStatus, "sent" | "failed" | "delivered">
  error?: string | null
  now: Date
}): Promise<boolean> {
  return withPlatformAdminContext(async (tx) =>
    completeSmsFromCallbackInTx(tx, input)
  )
}

export async function loadDeliveryById(
  id: string
): Promise<DeliveryRow | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select()
      .from(main.notificationDeliveries)
      .where(eq(main.notificationDeliveries.id, id))
      .limit(1)
    return row ? toRow(row) : null
  })
}

export async function recordProviderId(input: {
  id: string
  providerId: string
  now: Date
}): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .update(main.notificationDeliveries)
      .set({
        providerId: input.providerId,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(main.notificationDeliveries.id, input.id),
          or(
            isNull(main.notificationDeliveries.providerId),
            eq(main.notificationDeliveries.providerId, input.providerId)
          )
        )
      )
  })
}

export async function completeDelivery(input: {
  id: string
  runId: string
  claimedAt: Date
  status: Extract<DeliveryStatus, "sent" | "failed" | "suppressed">
  providerId?: string | null
  error?: string | null
  now: Date
}): Promise<boolean> {
  return withPlatformAdminContext(async (tx) => {
    const updated = await tx
      .update(main.notificationDeliveries)
      .set({
        status: input.status,
        error: input.error ?? null,
        updatedAt: input.now,
        ...(input.providerId ? { providerId: input.providerId } : {}),
      })
      .where(
        and(
          eq(main.notificationDeliveries.id, input.id),
          eq(main.notificationDeliveries.leaseOwner, input.runId),
          eq(main.notificationDeliveries.claimedAt, input.claimedAt)
        )
      )
      .returning({ id: main.notificationDeliveries.id })
    return Boolean(updated[0])
  })
}

export async function insertInboxRow(input: {
  deliveryId: string
  userId: string
  orgId: string | null
  kind: NotificationKind
  title: string
  body: string
  href?: string | null
  data?: Record<string, unknown>
}): Promise<void> {
  await withPlatformAdminContext(async (tx) => {
    await tx
      .insert(main.notifications)
      .values({
        userId: input.userId,
        orgId: input.orgId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        data: { ...(input.data ?? {}), deliveryId: input.deliveryId },
      })
      .onConflictDoNothing()
  })
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ id: main.emailSuppressions.id })
      .from(main.emailSuppressions)
      .where(
        sql`lower(${main.emailSuppressions.email}::text) = ${email.toLowerCase()}`
      )
      .limit(1)
    return Boolean(row)
  })
}

export type EmailUserRow = {
  userId: string
  email: string
  locale: string | null
}

export async function loadUserByEmail(
  email: string
): Promise<EmailUserRow | null> {
  return withPlatformAdminContext(async (tx) => {
    const rows = await tx
      .select({
        userId: auth.user.id,
        email: auth.user.email,
        locale: auth.user.locale,
      })
      .from(auth.user)
      .where(sql`lower(${auth.user.email}::text) = ${email.toLowerCase()}`)
    return pickUniqueEmailMatch(rows, email)
  })
}

export async function loadUserRecipient(userId: string): Promise<{
  userId: string
  email: string
  locale: string | null
  phoneE164: string | null
  phoneVerifiedAt: Date | null
} | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        userId: auth.user.id,
        email: auth.user.email,
        locale: auth.user.locale,
        phoneE164: auth.user.phoneE164,
        phoneVerifiedAt: auth.user.phoneVerifiedAt,
      })
      .from(auth.user)
      .where(eq(auth.user.id, userId))
      .limit(1)
    return row ?? null
  })
}
