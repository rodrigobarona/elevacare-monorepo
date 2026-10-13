import { and, eq, isNull, or } from "drizzle-orm"
import { listMemberOwnedSessionDocuments, main, type Tx } from "@eleva/db"
import { deletePrivateDocument } from "@eleva/storage"
import { toCsv } from "./dsar-csv"
import { hasDsarCollector, registerDsarCollector } from "./dsar-collectors"

export const SESSION_DOCUMENT_DSAR_COLLECTOR_ID = "session_documents" as const

export type EraseMemberSessionDocumentsResult = {
  deleted: number
  retainedExpertOnly: number
  blobFailures: number
}

/**
 * Phase 10 / D-12 member-account finalizer: delete member-uploaded and
 * shared documents (Blob first, then the row). Expert-only files stay
 * for clinical retention with `member_user_id` cleared.
 */
export async function eraseMemberSessionDocuments(
  tx: Tx,
  userId: string
): Promise<EraseMemberSessionDocumentsResult> {
  const rows = await tx
    .select({
      id: main.sessionDocuments.id,
      blobUrl: main.sessionDocuments.blobUrl,
    })
    .from(main.sessionDocuments)
    .where(
      and(
        isNull(main.sessionDocuments.deletedAt),
        or(
          eq(main.sessionDocuments.uploadedBy, userId),
          and(
            eq(main.sessionDocuments.memberUserId, userId),
            eq(main.sessionDocuments.scope, "shared")
          )
        )
      )
    )

  let deleted = 0
  let blobFailures = 0
  for (const row of rows) {
    try {
      await deletePrivateDocument(row.blobUrl)
    } catch {
      blobFailures += 1
      continue
    }
    await tx
      .delete(main.sessionDocuments)
      .where(eq(main.sessionDocuments.id, row.id))
    deleted += 1
  }

  const retained = await tx
    .update(main.sessionDocuments)
    .set({ memberUserId: null })
    .where(
      and(
        eq(main.sessionDocuments.memberUserId, userId),
        eq(main.sessionDocuments.scope, "expert_only")
      )
    )
    .returning({ id: main.sessionDocuments.id })

  return {
    deleted,
    retainedExpertOnly: retained.length,
    blobFailures,
  }
}

export function ensureSessionDocumentDsarCollector(): void {
  if (hasDsarCollector(SESSION_DOCUMENT_DSAR_COLLECTOR_ID)) return
  registerDsarCollector({
    id: SESSION_DOCUMENT_DSAR_COLLECTOR_ID,
    collect: async (userId) => {
      const rows = await listMemberOwnedSessionDocuments(userId)
      const json = rows.map((row) => ({
        id: row.id,
        orgId: row.orgId,
        bookingId: row.bookingId,
        mime: row.mime,
        sizeBytes: row.sizeBytes,
        scope: row.scope,
        uploadedBySelf: row.uploadedBy === userId,
        createdAt: row.createdAt.toISOString(),
      }))
      return {
        filename: "session_documents",
        json,
        csv: toCsv(json),
      }
    },
  })
}
