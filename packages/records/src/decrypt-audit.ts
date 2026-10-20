import { withAudit } from "@eleva/audit"

export type RecordViewer = "owning_expert" | "member" | "staff"
export type RecordReadPurpose = "session_view" | "member_report" | "dsar_export"

/** Phase 10 spec: 100% for staff (and members), 1% for the owning expert. */
export const RECORD_READ_SAMPLE_RATES: Record<RecordViewer, number> = {
  owning_expert: 0.01,
  member: 1,
  staff: 1,
}

export function shouldAuditRecordRead(
  viewer: RecordViewer,
  random: () => number = Math.random
): boolean {
  const rate = RECORD_READ_SAMPLE_RATES[viewer]
  return rate >= 1 || random() < rate
}

/**
 * Emits one `record.decrypted` row per read (ids only, never plaintext).
 * Reads with no records are not audited.
 */
export async function auditRecordRead(
  input: {
    orgId: string
    actorUserId: string | null
    viewer: RecordViewer
    purpose: RecordReadPurpose
    bookingId: string | null
    recordIds: string[]
  },
  random?: () => number
): Promise<void> {
  if (input.recordIds.length === 0) return
  if (!shouldAuditRecordRead(input.viewer, random)) return
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "record",
        action: "decrypted",
        entityId: input.bookingId,
        payload: {
          viewer: input.viewer,
          purpose: input.purpose,
          recordIds: input.recordIds,
          sampleRate: RECORD_READ_SAMPLE_RATES[input.viewer],
        },
      })
    }
  )
}
