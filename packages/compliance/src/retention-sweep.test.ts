import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { withPlatformAdminContext, withPlatformAudit } = vi.hoisted(() => ({
  withPlatformAdminContext: vi.fn(),
  withPlatformAudit: vi.fn(),
}))

vi.mock("@eleva/db", () => ({ withPlatformAdminContext }))
vi.mock("@eleva/audit", () => ({ withPlatformAudit }))
vi.mock("@eleva/storage", () => ({
  deletePrivateDocument: vi.fn(),
}))

vi.mock("@eleva/db/schema", () => ({
  consents: { userId: "user_id", bookingId: "booking_id" },
  records: {
    id: "id",
    orgId: "org_id",
    kind: "kind",
    memberUserId: "member_user_id",
    createdBy: "created_by",
    publishedAt: "published_at",
    updatedAt: "updated_at",
  },
  sessionDocuments: {
    id: "id",
    orgId: "org_id",
    blobUrl: "blob_url",
    createdAt: "created_at",
    retentionSweepAttempts: "retention_sweep_attempts",
    retentionLastError: "retention_last_error",
  },
  notificationDeliveries: {
    id: "id",
    orgId: "org_id",
    createdAt: "created_at",
  },
}))

import { deletePrivateDocument } from "@eleva/storage"
import {
  AI_DRAFT_RETENTION_DAYS,
  NOTIFICATION_DELIVERY_RETENTION_DAYS,
  eraseMemberClinicalRecords,
  subjectPseudonymForUser,
  sweepExpiredAiDrafts,
  sweepExpiredNotificationDeliveries,
  sweepExpiredSessionDocuments,
} from "./retention"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("eraseMemberClinicalRecords", () => {
  beforeEach(() => {
    vi.stubEnv("RETENTION_PSEUDONYM_KEY", "k".repeat(32))
  })

  it("deletes member-authored rows and tombstones expert-authored ones", async () => {
    const sets: Record<string, unknown>[] = []
    const tx = {
      delete: () => ({
        where: () => ({ returning: async () => [{ id: "own-1" }] }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values)
          return {
            where: () => ({
              returning: async () => [{ id: "expert-1" }, { id: "expert-2" }],
            }),
          }
        },
      }),
    }

    const result = await eraseMemberClinicalRecords(tx as never, "user-1")

    expect(result).toEqual({ deleted: 1, tombstoned: 2 })
    expect(sets).toHaveLength(1)
    expect(sets[0]?.memberUserId).toBeNull()
    const token = sets[0]?.subjectPseudonym
    expect(Buffer.isBuffer(token)).toBe(true)
    expect(
      (token as Buffer).equals(
        subjectPseudonymForUser("user-1", "k".repeat(32))
      )
    ).toBe(true)
  })

  it("fails closed without a pseudonym key", async () => {
    vi.stubEnv("RETENTION_PSEUDONYM_KEY", "")
    const tx = { delete: vi.fn(), update: vi.fn() }
    await expect(
      eraseMemberClinicalRecords(tx as never, "user-1")
    ).rejects.toThrow(/RETENTION_PSEUDONYM_KEY/)
    expect(tx.delete).not.toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })
})

describe("sweepExpiredAiDrafts", () => {
  const emit = vi.fn()

  beforeEach(() => {
    withPlatformAdminContext.mockReset()
    withPlatformAudit.mockReset()
    emit.mockReset()
  })

  it("keeps the 90-day policy", () => {
    expect(AI_DRAFT_RETENTION_DAYS).toBe(90)
  })

  it("does nothing when no draft has expired", async () => {
    withPlatformAdminContext.mockImplementation(async (fn) =>
      fn({
        select: () => ({
          from: () => ({ where: () => ({ limit: async () => [] }) }),
        }),
      })
    )

    const result = await sweepExpiredAiDrafts(new Date("2026-10-20"))

    expect(result).toEqual({
      aiDraftsDeleted: 0,
      sessionDocumentsDeleted: 0,
      sessionDocumentsBlobFailures: 0,
      notificationDeliveriesDeleted: 0,
      orgs: 0,
      hasMore: false,
    })
    expect(withPlatformAudit).not.toHaveBeenCalled()
  })

  it("deletes expired drafts with one audit event per org", async () => {
    withPlatformAdminContext.mockImplementation(async (fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                { id: "d1", orgId: "org-a" },
                { id: "d2", orgId: "org-a" },
                { id: "d3", orgId: "org-b" },
              ],
            }),
          }),
        }),
      })
    )
    const deletedByOrg: Record<string, { id: string }[]> = {
      "org-a": [{ id: "d1" }, { id: "d2" }],
      "org-b": [{ id: "d3" }],
    }
    withPlatformAudit.mockImplementation(async (opts, fn) =>
      fn(
        {
          delete: () => ({
            where: () => ({
              returning: async () => deletedByOrg[opts.orgId] ?? [],
            }),
          }),
        },
        { emit }
      )
    )

    const result = await sweepExpiredAiDrafts(new Date("2026-10-20"))

    expect(result).toEqual({
      aiDraftsDeleted: 3,
      sessionDocumentsDeleted: 0,
      sessionDocumentsBlobFailures: 0,
      notificationDeliveriesDeleted: 0,
      orgs: 2,
      hasMore: false,
    })
    expect(withPlatformAudit).toHaveBeenCalledTimes(2)
    expect(withPlatformAudit.mock.calls.map((call) => call[0])).toEqual([
      { orgId: "org-a" },
      { orgId: "org-b" },
    ])
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenCalledWith({
      entity: "record",
      action: "deleted",
      entityId: null,
      payload: {
        kind: "ai_draft",
        count: 2,
        reason: "retention",
        retentionDays: 90,
      },
    })
  })
})

describe("sweepExpiredSessionDocuments", () => {
  const emit = vi.fn()

  beforeEach(() => {
    withPlatformAdminContext.mockReset()
    withPlatformAudit.mockReset()
    emit.mockReset()
    vi.mocked(deletePrivateDocument).mockReset()
    vi.mocked(deletePrivateDocument).mockResolvedValue(undefined)
  })

  it("deletes blob then row when document is expired", async () => {
    withPlatformAdminContext.mockImplementation(async (fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "doc-1",
                  orgId: "org-a",
                  blobUrl: "records/org-a/doc.pdf",
                },
              ],
            }),
          }),
        }),
        update: vi.fn(),
      })
    )
    withPlatformAudit.mockImplementation(async (_opts, fn) =>
      fn(
        {
          delete: () => ({
            where: () => ({ returning: async () => [{ id: "doc-1" }] }),
          }),
        },
        { emit }
      )
    )

    const result = await sweepExpiredSessionDocuments(new Date("2026-10-20"))

    expect(deletePrivateDocument).toHaveBeenCalledWith("records/org-a/doc.pdf")
    expect(result).toEqual({ deleted: 1, blobFailures: 0, hasMore: false })
    expect(emit).toHaveBeenCalledWith({
      entity: "session_document",
      action: "deleted",
      entityId: "doc-1",
      payload: { reason: "retention", retentionDays: 365 * 7 },
    })
  })

  it("keeps row and increments attempts when blob delete fails", async () => {
    vi.mocked(deletePrivateDocument).mockRejectedValue(new Error("blob down"))
    const update = vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ attempts: 1 }],
        }),
      }),
    }))
    withPlatformAdminContext.mockImplementation(async (fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "doc-2",
                  orgId: "org-a",
                  blobUrl: "records/org-a/doc2.pdf",
                },
              ],
            }),
          }),
        }),
        update,
      })
    )

    const result = await sweepExpiredSessionDocuments(new Date("2026-10-20"))

    expect(result).toEqual({ deleted: 0, blobFailures: 1, hasMore: false })
    expect(withPlatformAudit).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})

describe("sweepExpiredNotificationDeliveries", () => {
  beforeEach(() => {
    withPlatformAdminContext.mockReset()
    withPlatformAudit.mockReset()
  })

  it("uses a one-year retention window", () => {
    expect(NOTIFICATION_DELIVERY_RETENTION_DAYS).toBe(365)
  })

  it("deletes expired delivery rows with audit per org", async () => {
    const emit = vi.fn()
    withPlatformAdminContext.mockImplementation(async (fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                { id: "d1", orgId: "org-a" },
                { id: "d2", orgId: null },
              ],
            }),
          }),
        }),
        delete: () => ({
          where: () => ({ returning: async () => [{ id: "d2" }] }),
        }),
      })
    )
    withPlatformAudit.mockImplementation(async (_opts, fn) =>
      fn(
        {
          delete: () => ({
            where: () => ({ returning: async () => [{ id: "d1" }] }),
          }),
        },
        { emit }
      )
    )

    const result = await sweepExpiredNotificationDeliveries(
      new Date("2026-10-20")
    )

    expect(result).toEqual({ deleted: 2, hasMore: false })
    expect(emit).toHaveBeenCalledWith({
      entity: "notification",
      action: "deleted",
      entityId: null,
      payload: {
        reason: "retention",
        retentionDays: 365,
        count: 1,
        scope: "delivery_log",
      },
    })
  })
})
