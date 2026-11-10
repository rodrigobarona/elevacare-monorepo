import { beforeEach, describe, expect, it, vi } from "vitest"

const { withPlatformAdminContext, isOrgMember } = vi.hoisted(() => ({
  withPlatformAdminContext: vi.fn(),
  isOrgMember: vi.fn(),
}))

vi.mock("@eleva/db", () => ({
  isOrgMember,
  withPlatformAdminContext,
  withOrgAndUserContext: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))

vi.mock("@eleva/encryption", () => ({
  decryptRecordFields: vi.fn(),
  encryptRecordFields: vi.fn(),
}))

import { requireDocumentUploader } from "./session-documents"

const BOOKING_ID = "00000000-0000-4000-8000-000000000001"
const EXPERT_ID = "00000000-0000-4000-8000-000000000003"
const MEMBER_ID = "00000000-0000-4000-8000-000000000004"
const ORG_ID = "00000000-0000-4000-8000-000000000005"
const OTHER_ID = "00000000-0000-4000-8000-000000000006"

const booking = {
  id: BOOKING_ID,
  orgId: ORG_ID,
  expertUserId: EXPERT_ID,
  memberUserId: MEMBER_ID,
}

describe("session document access", () => {
  beforeEach(() => {
    withPlatformAdminContext.mockReset()
    withPlatformAdminContext.mockResolvedValue([booking])
    isOrgMember.mockReset()
  })

  it("lets the booked expert in while they belong to the booking's org", async () => {
    isOrgMember.mockResolvedValue(true)
    await expect(
      requireDocumentUploader({
        bookingId: BOOKING_ID,
        actorUserId: EXPERT_ID,
      })
    ).resolves.toEqual(booking)
    expect(isOrgMember).toHaveBeenCalledWith(EXPERT_ID, ORG_ID)
  })

  it("shuts the booked expert out once removed from the booking's org", async () => {
    isOrgMember.mockResolvedValue(false)
    await expect(
      requireDocumentUploader({
        bookingId: BOOKING_ID,
        actorUserId: EXPERT_ID,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("keeps member access without a membership check", async () => {
    await expect(
      requireDocumentUploader({
        bookingId: BOOKING_ID,
        actorUserId: MEMBER_ID,
      })
    ).resolves.toEqual(booking)
    expect(isOrgMember).not.toHaveBeenCalled()
  })

  it("rejects anyone else", async () => {
    await expect(
      requireDocumentUploader({
        bookingId: BOOKING_ID,
        actorUserId: OTHER_ID,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
