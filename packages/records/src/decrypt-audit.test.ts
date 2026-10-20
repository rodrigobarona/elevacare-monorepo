import { beforeEach, describe, expect, it, vi } from "vitest"

const { withAudit, emit } = vi.hoisted(() => ({
  withAudit: vi.fn(),
  emit: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({ withAudit }))

import { auditRecordRead, shouldAuditRecordRead } from "./decrypt-audit"

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

describe("shouldAuditRecordRead", () => {
  it("always audits members and staff", () => {
    expect(shouldAuditRecordRead("member", () => 0.99)).toBe(true)
    expect(shouldAuditRecordRead("staff", () => 0.99)).toBe(true)
  })

  it("samples the owning expert at 1%", () => {
    expect(shouldAuditRecordRead("owning_expert", () => 0.005)).toBe(true)
    expect(shouldAuditRecordRead("owning_expert", () => 0.01)).toBe(false)
  })
})

describe("auditRecordRead", () => {
  it("emits record.decrypted with ids, viewer and purpose only", async () => {
    await auditRecordRead({ ...READ, viewer: "member" })
    expect(withAudit).toHaveBeenCalledWith(
      { orgId: READ.orgId, actorUserId: READ.actorUserId },
      expect.any(Function)
    )
    expect(emit).toHaveBeenCalledWith({
      entity: "record",
      action: "decrypted",
      entityId: READ.bookingId,
      payload: {
        viewer: "member",
        purpose: "session_view",
        recordIds: READ.recordIds,
        sampleRate: 1,
      },
    })
  })

  it("skips unsampled expert reads and empty reads", async () => {
    await auditRecordRead({ ...READ, viewer: "owning_expert" }, () => 0.5)
    await auditRecordRead({ ...READ, viewer: "member", recordIds: [] })
    expect(withAudit).not.toHaveBeenCalled()
  })
})
