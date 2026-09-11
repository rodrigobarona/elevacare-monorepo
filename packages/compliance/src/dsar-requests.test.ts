import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  withAudit,
  withPlatformAudit,
  withPlatformAdminContext,
  deletePrivateDocument,
  dsarExport,
} = vi.hoisted(() => ({
  withAudit: vi.fn(),
  withPlatformAudit: vi.fn(),
  withPlatformAdminContext: vi.fn(),
  deletePrivateDocument: vi.fn(),
  dsarExport: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: (...args: unknown[]) => withAudit(...args),
  withPlatformAudit: (...args: unknown[]) => withPlatformAudit(...args),
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
      processingStartedAt: "dsar.processing_started_at",
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

vi.mock("./dsar-export", async () => {
  const actual =
    await vi.importActual<typeof import("./dsar-export")>("./dsar-export")
  return {
    ...actual,
    dsarExport: (...args: unknown[]) => dsarExport(...args),
  }
})

import { markDsarExpired, processDsarExport } from "./dsar-requests"

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

describe("processDsarExport", () => {
  beforeEach(() => {
    withPlatformAudit.mockReset()
    withPlatformAdminContext.mockReset()
    dsarExport.mockReset()
  })

  it("asks the caller to retry a fresh processing claim", async () => {
    withPlatformAdminContext.mockResolvedValue([
      readyRow({ status: "processing", blobPathname: null, expiresAt: null }),
    ])
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          update: () => ({
            set: () => ({
              where: () => ({
                returning: async () => [],
              }),
            }),
          }),
        }
        return fn(tx, { emit: vi.fn() })
      }
    )

    await expect(
      processDsarExport({
        dsarId: "dsar-1",
        userId: "user-1",
        orgId: "org-1",
      })
    ).resolves.toEqual({ status: "skipped", retry: true })
    expect(dsarExport).not.toHaveBeenCalled()
  })

  it("reclaims a stale processing request", async () => {
    withPlatformAdminContext.mockResolvedValue([
      readyRow({ status: "processing", blobPathname: null, expiresAt: null }),
    ])
    const claimSets: unknown[] = []
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          update: () => ({
            set: (values: unknown) => {
              claimSets.push(values)
              return {
                where: () => ({
                  returning: async () =>
                    claimSets.length === 1 ? [{ id: "dsar-1" }] : [],
                }),
              }
            },
          }),
        }
        return fn(tx, { emit: vi.fn() })
      }
    )
    dsarExport.mockResolvedValue({
      blobUrl: BLOB_URL,
      expiresAt: new Date("2026-09-12T00:00:00.000Z"),
    })

    await expect(
      processDsarExport({
        dsarId: "dsar-1",
        userId: "user-1",
        orgId: "org-1",
      })
    ).resolves.toEqual({ status: "ready" })
    expect(claimSets[0]).toMatchObject({
      status: "processing",
      processingStartedAt: expect.any(Date),
    })
    expect(dsarExport).toHaveBeenCalledWith("user-1")
  })
})
