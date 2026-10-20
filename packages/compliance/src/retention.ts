import { createHmac } from "node:crypto"
import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { withPlatformAdminContext, type Tx } from "@eleva/db"
import {
  consents,
  notificationDeliveries,
  records,
  sessionDocuments,
} from "@eleva/db/schema"
import { deletePrivateDocument } from "@eleva/storage"

/** Product grace for `scheduled_for`. Not the clinical retention period. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14

/** Unpublished AI drafts are purged this long after their last change. */
export const AI_DRAFT_RETENTION_DAYS = 90

/**
 * Working pre-launch default for session document hard delete (Blob + row).
 * Final period is DPO-owned — see data-retention-export-matrix.md (AUD-028).
 */
export const SESSION_DOCUMENT_RETENTION_DAYS = 365 * 7

/** Delivery log rows older than this are purged (Phase 10 plan: 1y). */
export const NOTIFICATION_DELIVERY_RETENTION_DAYS = 365

/** Stop retrying Blob deletes after this many sweep failures. */
export const SESSION_DOCUMENT_RETENTION_MAX_ATTEMPTS = 3

const RETENTION_SWEEP_BATCH = 500

const RETENTION_PSEUDONYM_KEY_MIN_LENGTH = 32

export function subjectPseudonymForUser(
  userId: string,
  secret: string | undefined = process.env.RETENTION_PSEUDONYM_KEY
): Buffer {
  if (!secret || secret.length < RETENTION_PSEUDONYM_KEY_MIN_LENGTH) {
    throw new Error(
      "RETENTION_PSEUDONYM_KEY is not configured with at least 32 characters"
    )
  }
  return createHmac("sha256", secret).update(userId).digest()
}

async function pseudonymiseBookingConsentsInTx(
  tx: Tx,
  userId: string,
  token: Buffer
): Promise<void> {
  await tx
    .update(consents)
    .set({
      userId: null,
      guestEmailHash: null,
      subjectPseudonym: token,
    })
    .where(and(eq(consents.userId, userId), isNotNull(consents.bookingId)))
}

/**
 * Booking-scope D-12 step: replace the member identity with an HMAC
 * retention token. Account-scope rows (`booking_id IS NULL`) are erased
 * by the sweep, not this helper.
 */
export async function pseudonymiseBookingConsents(
  userId: string,
  tx?: Tx
): Promise<void> {
  const token = subjectPseudonymForUser(userId)
  if (tx) {
    await pseudonymiseBookingConsentsInTx(tx, userId, token)
    return
  }
  await withPlatformAdminContext((adminTx) =>
    pseudonymiseBookingConsentsInTx(adminTx, userId, token)
  )
}

export type ClinicalRecordErasureResult = {
  deleted: number
  tombstoned: number
}

/**
 * D-12 / AUD-030 account finalizer step. Records the member wrote are
 * erased, including `intake` (the member's booking-form text, stored with
 * the expert as `created_by`). Expert-authored records stay under the
 * clinical retention exception with the member id replaced by the HMAC
 * tombstone; their hard delete waits for the statutory period the DPO sets.
 */
export async function eraseMemberClinicalRecords(
  tx: Tx,
  userId: string
): Promise<ClinicalRecordErasureResult> {
  const token = subjectPseudonymForUser(userId)
  const memberAuthored = or(
    eq(records.createdBy, userId),
    eq(records.kind, "intake")
  )
  const deleted = await tx
    .delete(records)
    .where(and(eq(records.memberUserId, userId), memberAuthored))
    .returning({ id: records.id })
  const tombstoned = await tx
    .update(records)
    .set({ memberUserId: null, subjectPseudonym: token })
    .where(eq(records.memberUserId, userId))
    .returning({ id: records.id })
  return { deleted: deleted.length, tombstoned: tombstoned.length }
}

export type RetentionSweepResult = {
  aiDraftsDeleted: number
  sessionDocumentsDeleted: number
  sessionDocumentsBlobFailures: number
  notificationDeliveriesDeleted: number
  orgs: number
  hasMore: boolean
}

/**
 * Daily retention sweep: unpublished `ai_draft` records untouched for
 * {@link AI_DRAFT_RETENTION_DAYS}. One audit event per org batch.
 */
export async function sweepExpiredAiDrafts(
  now: Date = new Date()
): Promise<RetentionSweepResult> {
  const cutoff = new Date(
    now.getTime() - AI_DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
  const expired = await withPlatformAdminContext((tx) =>
    tx
      .select({ id: records.id, orgId: records.orgId })
      .from(records)
      .where(
        and(
          eq(records.kind, "ai_draft"),
          isNull(records.publishedAt),
          lt(records.updatedAt, cutoff)
        )
      )
      .limit(RETENTION_SWEEP_BATCH)
  )

  const byOrg = new Map<string, string[]>()
  for (const row of expired) {
    const ids = byOrg.get(row.orgId) ?? []
    ids.push(row.id)
    byOrg.set(row.orgId, ids)
  }

  let aiDraftsDeleted = 0
  for (const [orgId, ids] of byOrg) {
    aiDraftsDeleted += await withPlatformAudit({ orgId }, async (tx, ctx) => {
      const deleted = await tx
        .delete(records)
        .where(
          and(
            inArray(records.id, ids),
            eq(records.kind, "ai_draft"),
            isNull(records.publishedAt),
            lt(records.updatedAt, cutoff)
          )
        )
        .returning({ id: records.id })
      await ctx.emit({
        entity: "record",
        action: "deleted",
        entityId: null,
        payload: {
          kind: "ai_draft",
          count: deleted.length,
          reason: "retention",
          retentionDays: AI_DRAFT_RETENTION_DAYS,
        },
      })
      return deleted.length
    })
  }

  return {
    aiDraftsDeleted,
    sessionDocumentsDeleted: 0,
    sessionDocumentsBlobFailures: 0,
    notificationDeliveriesDeleted: 0,
    orgs: byOrg.size,
    hasMore: expired.length === RETENTION_SWEEP_BATCH,
  }
}

export type SessionDocumentSweepResult = {
  deleted: number
  blobFailures: number
  hasMore: boolean
}

/**
 * Hard-delete session documents past {@link SESSION_DOCUMENT_RETENTION_DAYS}:
 * private Blob first, then the row. Failed Blob deletes increment
 * `retention_sweep_attempts` and stop after
 * {@link SESSION_DOCUMENT_RETENTION_MAX_ATTEMPTS}.
 */
export async function sweepExpiredSessionDocuments(
  now: Date = new Date()
): Promise<SessionDocumentSweepResult> {
  const cutoff = new Date(
    now.getTime() - SESSION_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
  const expired = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: sessionDocuments.id,
        orgId: sessionDocuments.orgId,
        blobUrl: sessionDocuments.blobUrl,
      })
      .from(sessionDocuments)
      .where(
        and(
          lt(sessionDocuments.createdAt, cutoff),
          lt(
            sessionDocuments.retentionSweepAttempts,
            SESSION_DOCUMENT_RETENTION_MAX_ATTEMPTS
          )
        )
      )
      .limit(RETENTION_SWEEP_BATCH)
  )

  let deleted = 0
  let blobFailures = 0

  for (const row of expired) {
    try {
      await deletePrivateDocument(row.blobUrl)
    } catch (err) {
      blobFailures += 1
      const message =
        err instanceof Error ? err.message : "Unknown blob delete error"
      const [afterFail] = await withPlatformAdminContext((tx) =>
        tx
          .update(sessionDocuments)
          .set({
            retentionLastError: message.slice(0, 500),
            retentionSweepAttempts: sql`${sessionDocuments.retentionSweepAttempts} + 1`,
          })
          .where(eq(sessionDocuments.id, row.id))
          .returning({ attempts: sessionDocuments.retentionSweepAttempts })
      )
      if (
        afterFail?.attempts !== undefined &&
        afterFail.attempts >= SESSION_DOCUMENT_RETENTION_MAX_ATTEMPTS
      ) {
        console.error(
          "[retention-sweep] session_document blob delete exhausted retries",
          { documentId: row.id, orgId: row.orgId }
        )
      }
      continue
    }

    const count = await withPlatformAudit(
      { orgId: row.orgId },
      async (tx, ctx) => {
        const removed = await tx
          .delete(sessionDocuments)
          .where(eq(sessionDocuments.id, row.id))
          .returning({ id: sessionDocuments.id })
        if (removed.length > 0) {
          await ctx.emit({
            entity: "session_document",
            action: "deleted",
            entityId: row.id,
            payload: {
              reason: "retention",
              retentionDays: SESSION_DOCUMENT_RETENTION_DAYS,
            },
          })
        }
        return removed.length
      }
    )
    deleted += count
  }

  return {
    deleted,
    blobFailures,
    hasMore: expired.length === RETENTION_SWEEP_BATCH,
  }
}

export type NotificationDeliverySweepResult = {
  deleted: number
  hasMore: boolean
}

/** Purge notification delivery log rows older than 1 year (batched). */
export async function sweepExpiredNotificationDeliveries(
  now: Date = new Date()
): Promise<NotificationDeliverySweepResult> {
  const cutoff = new Date(
    now.getTime() - NOTIFICATION_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
  const expired = await withPlatformAdminContext((tx) =>
    tx
      .select({
        id: notificationDeliveries.id,
        orgId: notificationDeliveries.orgId,
      })
      .from(notificationDeliveries)
      .where(lt(notificationDeliveries.createdAt, cutoff))
      .limit(RETENTION_SWEEP_BATCH)
  )

  const byOrg = new Map<string, string[]>()
  const authScoped: string[] = []
  for (const row of expired) {
    if (row.orgId) {
      const ids = byOrg.get(row.orgId) ?? []
      ids.push(row.id)
      byOrg.set(row.orgId, ids)
    } else {
      authScoped.push(row.id)
    }
  }

  let deleted = 0

  for (const [orgId, ids] of byOrg) {
    deleted += await withPlatformAudit({ orgId }, async (tx, ctx) => {
      const removed = await tx
        .delete(notificationDeliveries)
        .where(inArray(notificationDeliveries.id, ids))
        .returning({ id: notificationDeliveries.id })
      await ctx.emit({
        entity: "notification",
        action: "deleted",
        entityId: null,
        payload: {
          reason: "retention",
          retentionDays: NOTIFICATION_DELIVERY_RETENTION_DAYS,
          count: removed.length,
          scope: "delivery_log",
        },
      })
      return removed.length
    })
  }

  if (authScoped.length > 0) {
    deleted += await withPlatformAdminContext(async (tx) => {
      const removed = await tx
        .delete(notificationDeliveries)
        .where(inArray(notificationDeliveries.id, authScoped))
        .returning({ id: notificationDeliveries.id })
      return removed.length
    })
  }

  return {
    deleted,
    hasMore: expired.length === RETENTION_SWEEP_BATCH,
  }
}

/**
 * Daily retention sweep: AI drafts, session documents (Blob + row), and
 * notification delivery logs. Batched; `hasMore` means schedule another run.
 */
export async function runRetentionSweep(
  now: Date = new Date()
): Promise<RetentionSweepResult> {
  const aiDrafts = await sweepExpiredAiDrafts(now)
  const documents = await sweepExpiredSessionDocuments(now)
  const deliveries = await sweepExpiredNotificationDeliveries(now)

  return {
    aiDraftsDeleted: aiDrafts.aiDraftsDeleted,
    sessionDocumentsDeleted: documents.deleted,
    sessionDocumentsBlobFailures: documents.blobFailures,
    notificationDeliveriesDeleted: deliveries.deleted,
    orgs: aiDrafts.orgs,
    hasMore: aiDrafts.hasMore || documents.hasMore || deliveries.hasMore,
  }
}
