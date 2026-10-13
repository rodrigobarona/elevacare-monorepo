import { and, eq, isNull, or } from "drizzle-orm"
import { sessionDocuments } from "../schema/main"
import { withPlatformAdminContext } from "../context"

export type MemberOwnedSessionDocument = {
  id: string
  orgId: string
  bookingId: string | null
  mime: string
  sizeBytes: number
  scope: (typeof sessionDocuments.$inferSelect)["scope"]
  uploadedBy: string
  createdAt: Date
}

/**
 * Documents the member uploaded, plus shared documents on their bookings.
 * Expert-only files they did not upload stay off the DSAR pack (D-11).
 */
export async function listMemberOwnedSessionDocuments(
  userId: string
): Promise<MemberOwnedSessionDocument[]> {
  return withPlatformAdminContext(async (tx) =>
    tx
      .select({
        id: sessionDocuments.id,
        orgId: sessionDocuments.orgId,
        bookingId: sessionDocuments.bookingId,
        mime: sessionDocuments.mime,
        sizeBytes: sessionDocuments.sizeBytes,
        scope: sessionDocuments.scope,
        uploadedBy: sessionDocuments.uploadedBy,
        createdAt: sessionDocuments.createdAt,
      })
      .from(sessionDocuments)
      .where(
        and(
          isNull(sessionDocuments.deletedAt),
          or(
            eq(sessionDocuments.uploadedBy, userId),
            and(
              eq(sessionDocuments.memberUserId, userId),
              eq(sessionDocuments.scope, "shared")
            )
          )
        )
      )
  )
}
