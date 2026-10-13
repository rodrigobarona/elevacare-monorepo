import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SESSION_DOCUMENT_DSAR_COLLECTOR_ID,
  ensureSessionDocumentDsarCollector,
  eraseMemberSessionDocuments,
} from "./session-document-lifecycle"
import {
  listDsarCollectors,
  resetDsarCollectorsForTests,
} from "./dsar-collectors"

const deletePrivateDocument = vi.fn()
const listMemberOwnedSessionDocuments = vi.fn()

vi.mock("@eleva/storage", () => ({
  deletePrivateDocument: (...args: unknown[]) => deletePrivateDocument(...args),
}))

vi.mock("@eleva/db", () => ({
  listMemberOwnedSessionDocuments: (...args: unknown[]) =>
    listMemberOwnedSessionDocuments(...args),
  main: {
    sessionDocuments: {
      id: "docs.id",
      blobUrl: "docs.blob_url",
      uploadedBy: "docs.uploaded_by",
      memberUserId: "docs.member_user_id",
      scope: "docs.scope",
      deletedAt: "docs.deleted_at",
    },
  },
}))

afterEach(() => {
  resetDsarCollectorsForTests()
  deletePrivateDocument.mockReset()
  listMemberOwnedSessionDocuments.mockReset()
})

describe("eraseMemberSessionDocuments", () => {
  it("deletes the Blob then the row, and skips a store failure", async () => {
    const deletedIds: string[] = []
    const tx = {
      select: () => ({
        from: () => ({
          where: async () => [
            { id: "doc-ok", blobUrl: "https://blob/ok" },
            { id: "doc-fail", blobUrl: "https://blob/fail" },
          ],
        }),
      }),
      delete: () => ({
        where: async () => {
          deletedIds.push("deleted")
        },
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => [{ id: "expert-only" }],
          }),
        }),
      }),
    }
    deletePrivateDocument.mockImplementation(async (url: string) => {
      if (url.endsWith("/fail")) throw new Error("store down")
    })

    const result = await eraseMemberSessionDocuments(tx as never, "user-1")
    expect(deletePrivateDocument).toHaveBeenCalledTimes(2)
    expect(deletedIds).toEqual(["deleted"])
    expect(result).toEqual({
      deleted: 1,
      retainedExpertOnly: 1,
      blobFailures: 1,
    })
  })
})

describe("ensureSessionDocumentDsarCollector", () => {
  it("registers once and lists owned document metadata", async () => {
    listMemberOwnedSessionDocuments.mockResolvedValue([
      {
        id: "doc-1",
        orgId: "org-1",
        bookingId: "booking-1",
        mime: "application/pdf",
        sizeBytes: 1200,
        scope: "shared",
        uploadedBy: "user-1",
        createdAt: new Date("2026-10-13T10:00:00.000Z"),
      },
    ])
    ensureSessionDocumentDsarCollector()
    ensureSessionDocumentDsarCollector()
    expect(listDsarCollectors().map((c) => c.id)).toEqual([
      SESSION_DOCUMENT_DSAR_COLLECTOR_ID,
    ])
    const result = await listDsarCollectors()[0]!.collect("user-1")
    expect(result.json).toEqual([
      expect.objectContaining({
        id: "doc-1",
        mime: "application/pdf",
        uploadedBySelf: true,
      }),
    ])
  })
})
