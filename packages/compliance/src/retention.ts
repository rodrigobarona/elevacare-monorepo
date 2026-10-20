import { createHmac } from "node:crypto"
import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { withPlatformAdminContext, type Tx } from "@eleva/db"
import { consents, records } from "@eleva/db/schema"

/** Product grace for `scheduled_for`. Not the clinical retention period. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14

/** Unpublished AI drafts are purged this long after their last change. */
export const AI_DRAFT_RETENTION_DAYS = 90

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
    orgs: byOrg.size,
    hasMore: expired.length === RETENTION_SWEEP_BATCH,
  }
}
