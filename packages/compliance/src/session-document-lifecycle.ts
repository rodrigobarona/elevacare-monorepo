import { and, eq, isNull, or } from "drizzle-orm"
import { listMemberOwnedSessionDocuments, main, type Tx } from "@eleva/db"
import { mintSessionDocumentUrl, SessionDocumentError } from "@eleva/records"
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
 * shared documents (object first, then the row). Expert-only files stay
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

/** Base URL of `apps/api`, where signed document downloads are served. */
function dsarDocumentApiBase(): string | undefined {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
}

type DsarDocumentLink = {
  downloadUrl: string | null
  downloadUrlExpiresAt: string | null
  /**
   * Authenticated endpoint that mints a fresh 15-minute link. The export ZIP
   * stays downloadable longer than one grant lives, so `downloadUrl` can
   * expire before the member opens it; this path never does.
   */
  downloadUrlRefreshPath: string | null
}

/**
 * Per-document signed download link with the standard 15-minute grant TTL
 * (Phase 10 DSAR). Minting goes through the same path as the member UI, so
 * every export link is authorised against the booking and audited as
 * `session_document.opened`. A document that cannot be linked (object store
 * outage, scope change) is still listed, with a null URL.
 */
async function mintDsarDocumentLink(
  apiBase: string | undefined,
  userId: string,
  row: { id: string; bookingId: string | null }
): Promise<DsarDocumentLink> {
  const none = {
    downloadUrl: null,
    downloadUrlExpiresAt: null,
    downloadUrlRefreshPath: null,
  }
  if (!apiBase || !row.bookingId) return none
  const downloadUrlRefreshPath = `${apiBase.replace(/\/$/, "")}/sessions/${encodeURIComponent(row.bookingId)}/documents/${encodeURIComponent(row.id)}/url`
  try {
    const result = await mintSessionDocumentUrl({
      bookingId: row.bookingId,
      documentId: row.id,
      actorUserId: userId,
      apiBase,
    })
    return {
      downloadUrl: result.url,
      downloadUrlExpiresAt: result.expiresAt,
      downloadUrlRefreshPath,
    }
  } catch (err) {
    if (err instanceof SessionDocumentError) return none
    throw err
  }
}

export function ensureSessionDocumentDsarCollector(): void {
  if (hasDsarCollector(SESSION_DOCUMENT_DSAR_COLLECTOR_ID)) return
  registerDsarCollector({
    id: SESSION_DOCUMENT_DSAR_COLLECTOR_ID,
    collect: async (userId) => {
      const rows = await listMemberOwnedSessionDocuments(userId)
      const apiBase = dsarDocumentApiBase()
      const json = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          orgId: row.orgId,
          bookingId: row.bookingId,
          mime: row.mime,
          sizeBytes: row.sizeBytes,
          scope: row.scope,
          uploadedBySelf: row.uploadedBy === userId,
          createdAt: row.createdAt.toISOString(),
          ...(await mintDsarDocumentLink(apiBase, userId, row)),
        }))
      )
      return {
        filename: "session_documents",
        json,
        csv: toCsv(json),
      }
    },
  })
}
