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

const mintSessionDocumentUrl = vi.fn()
const deletePrivateDocument = vi.fn()
const listMemberOwnedSessionDocuments = vi.fn()

vi.mock("@eleva/records", () => {
  class SessionDocumentError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }
  return {
    SessionDocumentError,
    mintSessionDocumentUrl: (...args: unknown[]) =>
      mintSessionDocumentUrl(...args),
  }
})

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
  mintSessionDocumentUrl.mockReset()
  vi.unstubAllEnvs()
})

describe("eraseMemberSessionDocuments", () => {
  it("deletes the Blob then the row, skips a store failure, and tombstones expert_only only", async () => {
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

const ownedRow = (id: string) => ({
  id,
  orgId: "org-1",
  bookingId: "booking-1",
  mime: "application/pdf",
  sizeBytes: 1200,
  scope: "shared",
  uploadedBy: "user-1",
  createdAt: new Date("2026-10-13T10:00:00.000Z"),
})

describe("ensureSessionDocumentDsarCollector", () => {
  it("registers once and lists owned documents with a signed download link", async () => {
    vi.stubEnv("API_URL", "https://api.eleva.test")
    listMemberOwnedSessionDocuments.mockResolvedValue([ownedRow("doc-1")])
    mintSessionDocumentUrl.mockResolvedValue({
      url: "https://api.eleva.test/sessions/booking-1/documents/doc-1/download?g=t",
      expiresAt: "2026-10-13T10:15:00.000Z",
    })
    ensureSessionDocumentDsarCollector()
    ensureSessionDocumentDsarCollector()
    expect(listDsarCollectors().map((c) => c.id)).toEqual([
      SESSION_DOCUMENT_DSAR_COLLECTOR_ID,
    ])
    const result = await listDsarCollectors()[0]!.collect("user-1")
    expect(mintSessionDocumentUrl).toHaveBeenCalledWith({
      bookingId: "booking-1",
      documentId: "doc-1",
      actorUserId: "user-1",
      apiBase: "https://api.eleva.test",
    })
    expect(result.json).toEqual([
      expect.objectContaining({
        id: "doc-1",
        mime: "application/pdf",
        uploadedBySelf: true,
        downloadUrl:
          "https://api.eleva.test/sessions/booking-1/documents/doc-1/download?g=t",
        downloadUrlExpiresAt: "2026-10-13T10:15:00.000Z",
        downloadUrlRefreshPath:
          "https://api.eleva.test/sessions/booking-1/documents/doc-1/url",
      }),
    ])
  })

  it("still lists a document with a null link when the grant cannot be minted", async () => {
    vi.stubEnv("API_URL", "https://api.eleva.test")
    const { SessionDocumentError } = await import("@eleva/records")
    listMemberOwnedSessionDocuments.mockResolvedValue([ownedRow("doc-2")])
    mintSessionDocumentUrl.mockRejectedValue(
      new SessionDocumentError("FORBIDDEN")
    )
    ensureSessionDocumentDsarCollector()
    const result = await listDsarCollectors()[0]!.collect("user-1")
    expect(result.json).toEqual([
      expect.objectContaining({
        id: "doc-2",
        downloadUrl: null,
        downloadUrlExpiresAt: null,
      }),
    ])
  })

  it("does not mint grants when no API base is configured", async () => {
    vi.stubEnv("API_URL", "")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "")
    listMemberOwnedSessionDocuments.mockResolvedValue([ownedRow("doc-3")])
    ensureSessionDocumentDsarCollector()
    const result = await listDsarCollectors()[0]!.collect("user-1")
    expect(mintSessionDocumentUrl).not.toHaveBeenCalled()
    expect(result.json).toEqual([
      expect.objectContaining({ id: "doc-3", downloadUrl: null }),
    ])
  })

  it("propagates unexpected failures instead of exporting a silent gap", async () => {
    vi.stubEnv("API_URL", "https://api.eleva.test")
    listMemberOwnedSessionDocuments.mockResolvedValue([ownedRow("doc-4")])
    mintSessionDocumentUrl.mockRejectedValue(new Error("db down"))
    ensureSessionDocumentDsarCollector()
    await expect(listDsarCollectors()[0]!.collect("user-1")).rejects.toThrow(
      "db down"
    )
  })
})
