import { beforeEach, describe, expect, it, vi } from "vitest"

const { withPlatformAdminContext, withAudit, decryptRecordFields } = vi.hoisted(
  () => ({
    withPlatformAdminContext: vi.fn(),
    withAudit: vi.fn(),
    decryptRecordFields: vi.fn(),
  })
)

vi.mock("@eleva/db", () => ({
  withPlatformAdminContext,
  withOrgAndUserContext: vi.fn(),
  withOrgContext: vi.fn(),
  withUserContext: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({ withAudit }))

vi.mock("@eleva/encryption", () => ({
  decryptRecordFields,
  encryptRecordFields: vi.fn(),
}))

import { setSessionRecordPublished } from "./session-records"

const BOOKING_ID = "00000000-0000-4000-8000-000000000001"
const RECORD_ID = "00000000-0000-4000-8000-000000000002"
const EXPERT_ID = "00000000-0000-4000-8000-000000000003"
const MEMBER_ID = "00000000-0000-4000-8000-000000000004"
const ORG_ID = "00000000-0000-4000-8000-000000000005"

function booking(memberUserId: string | null) {
  return {
    id: BOOKING_ID,
    orgId: ORG_ID,
    expertUserId: EXPERT_ID,
    memberUserId,
  }
}

function fakeTx(existing: unknown, updated: unknown) {
  const set = vi.fn(() => ({
    where: () => ({ returning: async () => (updated ? [updated] : []) }),
  }))
  return {
    set,
    tx: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => (existing ? [existing] : []) }),
        }),
      }),
      update: () => ({ set }),
    },
  }
}

function recordRow(publishedAt: Date | null) {
  return {
    id: RECORD_ID,
    kind: "report",
    titleEncrypted: "t",
    bodyEncrypted: "b",
    version: 2,
    updatedAt: new Date("2026-10-20T10:00:00.000Z"),
    publishedAt,
  }
}

describe("setSessionRecordPublished", () => {
  const emit = vi.fn()

  beforeEach(() => {
    withPlatformAdminContext.mockReset()
    withAudit.mockReset()
    emit.mockReset()
    decryptRecordFields.mockResolvedValue({
      reveal: () => ({ title: "Session report", body: "Keep stretching" }),
    })
  })

  const input = {
    bookingId: BOOKING_ID,
    recordId: RECORD_ID,
    actorUserId: EXPERT_ID,
    published: true,
  }

  it("rejects other users with FORBIDDEN", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(MEMBER_ID)])
    await expect(
      setSessionRecordPublished({ ...input, actorUserId: MEMBER_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("refuses bookings without a member account", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(null)])
    await expect(setSessionRecordPublished(input)).rejects.toMatchObject({
      code: "NOT_PUBLISHABLE",
    })
  })

  it("refuses kinds other than report", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(MEMBER_ID)])
    const { tx } = fakeTx({ kind: "internal_report", publishedAt: null }, null)
    withAudit.mockImplementation(async (_opts, fn) => fn(tx, { emit }))
    await expect(setSessionRecordPublished(input)).rejects.toMatchObject({
      code: "NOT_PUBLISHABLE",
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it("publishes a report and emits one audit event", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(MEMBER_ID)])
    const publishedAt = new Date("2026-10-20T11:00:00.000Z")
    const { tx, set } = fakeTx(
      { kind: "report", publishedAt: null },
      recordRow(publishedAt)
    )
    withAudit.mockImplementation(async (_opts, fn) => fn(tx, { emit }))

    const view = await setSessionRecordPublished(input)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: expect.any(Date) })
    )
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({
      entity: "record",
      action: "published",
      entityId: RECORD_ID,
      payload: { kind: "report", bookingId: BOOKING_ID },
    })
    expect(view).toMatchObject({
      id: RECORD_ID,
      kind: "report",
      body: "Keep stretching",
      publishedAt: publishedAt.toISOString(),
    })
  })

  it("keeps the first publish time when publishing again", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(MEMBER_ID)])
    const firstPublish = new Date("2026-10-19T09:00:00.000Z")
    const { tx, set } = fakeTx(
      { kind: "report", publishedAt: firstPublish },
      recordRow(firstPublish)
    )
    withAudit.mockImplementation(async (_opts, fn) => fn(tx, { emit }))

    await setSessionRecordPublished(input)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: firstPublish })
    )
  })

  it("unpublishes by clearing publishedAt", async () => {
    withPlatformAdminContext.mockResolvedValue([booking(MEMBER_ID)])
    const { tx, set } = fakeTx(
      { kind: "report", publishedAt: new Date() },
      recordRow(null)
    )
    withAudit.mockImplementation(async (_opts, fn) => fn(tx, { emit }))

    const view = await setSessionRecordPublished({ ...input, published: false })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: null })
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unpublished" })
    )
    expect(view.publishedAt).toBeNull()
  })
})
