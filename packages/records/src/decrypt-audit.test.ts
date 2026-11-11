import { beforeEach, describe, expect, it, vi } from "vitest"

const { withAudit, emit } = vi.hoisted(() => ({
  withAudit: vi.fn(),
  emit: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({ withAudit }))

import { auditRecordRead, type RecordViewer } from "./decrypt-audit"

const READ = {
  orgId: "00000000-0000-4000-8000-000000000005",
  actorUserId: "00000000-0000-4000-8000-000000000003",
  bookingId: "00000000-0000-4000-8000-000000000001",
  recordIds: ["00000000-0000-4000-8000-000000000002"],
  purpose: "session_view" as const,
}

beforeEach(() => {
  withAudit.mockReset()
  emit.mockReset()
  withAudit.mockImplementation(
    async (_options: unknown, fn: (tx: unknown, ctx: unknown) => unknown) =>
      fn({}, { emit })
  )
})

describe("auditRecordRead", () => {
  it.each<RecordViewer>(["owning_expert", "member", "staff"])(
    "audits every read by %s, with ids, viewer and purpose only",
    async (viewer) => {
      await auditRecordRead({ ...READ, viewer })
      expect(withAudit).toHaveBeenCalledTimes(1)
      expect(withAudit).toHaveBeenCalledWith(
        { orgId: READ.orgId, actorUserId: READ.actorUserId },
        expect.any(Function)
      )
      expect(emit).toHaveBeenCalledWith({
        entity: "record",
        action: "decrypted",
        entityId: READ.bookingId,
        payload: {
          viewer,
          purpose: "session_view",
          recordIds: READ.recordIds,
        },
      })
    }
  )

  it("audits the owning expert every time, never a sample (PRIV2-04)", async () => {
    for (let read = 0; read < 25; read += 1) {
      await auditRecordRead({ ...READ, viewer: "owning_expert" })
    }
    expect(emit).toHaveBeenCalledTimes(25)
  })

  it("does not audit a read that returned no records", async () => {
    await auditRecordRead({ ...READ, viewer: "member", recordIds: [] })
    expect(withAudit).not.toHaveBeenCalled()
  })
})
