import { withAudit } from "@eleva/audit"

export type RecordViewer = "owning_expert" | "member" | "staff"
export type RecordReadPurpose = "session_view" | "member_report" | "dsar_export"

/**
 * Emits one `record.decrypted` row for every read of session records, by
 * anyone: the expert who wrote them, the member, or staff. Ids only, never
 * plaintext. The access log health data needs is complete, not a sample
 * (Lei 58/2019 art. 29: date, time, who, and what was read).
 *
 * A read that returns no records is not audited: nothing was read.
 */
export async function auditRecordRead(input: {
  orgId: string
  actorUserId: string | null
  viewer: RecordViewer
  purpose: RecordReadPurpose
  bookingId: string | null
  recordIds: string[]
}): Promise<void> {
  if (input.recordIds.length === 0) return
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
        },
      })
    }
  )
}
