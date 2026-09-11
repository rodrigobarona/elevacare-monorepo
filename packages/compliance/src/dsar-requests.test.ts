import { beforeEach, describe, expect, it, vi } from "vitest"

const { withAudit, withPlatformAdminContext, deletePrivateDocument } =
  vi.hoisted(() => ({
    withAudit: vi.fn(),
    withPlatformAdminContext: vi.fn(),
    deletePrivateDocument: vi.fn(),
  }))

vi.mock("@eleva/audit", () => ({
  withAudit: (...args: unknown[]) => withAudit(...args),
  withPlatformAudit: vi.fn(),
}))

vi.mock("@eleva/db", () => ({
  main: {
    dsarRequests: {
      id: "dsar.id",
      userId: "dsar.user_id",
      status: "dsar.status",
      requestedAt: "dsar.requested_at",
      expiresAt: "dsar.expires_at",
      blobPathname: "dsar.blob_pathname",
      completedAt: "dsar.completed_at",
    },
    dsarRequestStatusEnum: {
      enumValues: ["pending", "processing", "ready", "expired", "failed"],
    },
  },
  withPlatformAdminContext: (...args: unknown[]) =>
    withPlatformAdminContext(...args),
}))

vi.mock("@eleva/storage", () => ({
  deletePrivateDocument: (...args: unknown[]) => deletePrivateDocument(...args),
}))

import { markDsarExpired } from "./dsar-requests"

const BLOB_URL =
  "https://private.blob.vercel-storage.com/dsar/user-1/export.zip"

function readyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "dsar-1",
    status: "ready",
    requestedAt: new Date("2026-09-10T00:00:00.000Z"),
    expiresAt: new Date("2026-09-10T01:00:00.000Z"),
    blobPathname: BLOB_URL,
    completedAt: new Date("2026-09-10T00:00:00.000Z"),
    ...overrides,
  }
}

describe("markDsarExpired", () => {
  beforeEach(() => {
    withAudit.mockReset()
    withPlatformAdminContext.mockReset()
    deletePrivateDocument.mockReset()
    deletePrivateDocument.mockResolvedValue(undefined)
  })

  it("deletes the private blob before flipping status to expired", async () => {
    withPlatformAdminContext.mockResolvedValue([readyRow()])
    const statusSets: unknown[] = []
    const emit = vi.fn()
    withAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (
          tx: {
            update: () => {
              set: (values: unknown) => { where: () => Promise<void> }
            }
          },
          ctx: { emit: typeof emit }
        ) => Promise<void>
      ) => {
        const tx = {
          update: () => ({
            set: (values: unknown) => {
              statusSets.push(values)
              return { where: async () => undefined }
            },
          }),
        }
        return fn(tx, { emit })
      }
    )

    await markDsarExpired({
      userId: "user-1",
      orgId: "org-1",
      dsarId: "dsar-1",
    })

    expect(deletePrivateDocument).toHaveBeenCalledWith(BLOB_URL)
    expect(deletePrivateDocument.mock.invocationCallOrder[0]).toBeLessThan(
      withAudit.mock.invocationCallOrder[0]!
    )
    expect(statusSets).toEqual([{ status: "expired", blobPathname: null }])
    expect(emit).toHaveBeenCalledWith({
      entity: "dsar_request",
      action: "expired",
      entityId: "dsar-1",
      payload: {},
    })
  })

  it("does not mark expired when blob delete fails", async () => {
    withPlatformAdminContext.mockResolvedValue([readyRow()])
    deletePrivateDocument.mockRejectedValue(new Error("blob unavailable"))
    withAudit.mockResolvedValue(undefined)

    await expect(
      markDsarExpired({
        userId: "user-1",
        orgId: "org-1",
        dsarId: "dsar-1",
      })
    ).rejects.toThrow(/blob unavailable/)
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("is a no-op when the export is already expired and the blob is gone", async () => {
    withPlatformAdminContext.mockResolvedValue([
      readyRow({ status: "expired", blobPathname: null }),
    ])

    await markDsarExpired({
      userId: "user-1",
      orgId: "org-1",
      dsarId: "dsar-1",
    })

    expect(deletePrivateDocument).not.toHaveBeenCalled()
    expect(withAudit).not.toHaveBeenCalled()
  })
})
