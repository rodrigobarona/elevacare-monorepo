import { beforeEach, describe, expect, it, vi } from "vitest"

const { withPlatformAdminContext, withAudit, hasActiveAiProcessingConsent } =
  vi.hoisted(() => ({
    withPlatformAdminContext: vi.fn(),
    withAudit: vi.fn(),
    hasActiveAiProcessingConsent: vi.fn(),
  }))

vi.mock("@eleva/db", () => ({
  hasActiveAiProcessingConsent,
  withPlatformAdminContext,
  withOrgAndUserContext: vi.fn(),
  withOrgContext: vi.fn(),
  withUserContext: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({ withAudit }))

vi.mock("@eleva/encryption", () => ({
  decryptRecordFields: vi.fn(),
  encryptRecordFields: vi.fn(),
}))

import { SessionRecordError } from "./errors"
import { upsertSessionRecord } from "./session-records"

const BOOKING_ID = "00000000-0000-4000-8000-000000000001"
const EXPERT_ID = "00000000-0000-4000-8000-000000000003"
const MEMBER_ID = "00000000-0000-4000-8000-000000000004"
const ORG_ID = "00000000-0000-4000-8000-000000000005"

describe("upsertSessionRecord transcript consent gate", () => {
  beforeEach(() => {
    withAudit.mockReset()
    hasActiveAiProcessingConsent.mockReset()
    const row = {
      id: BOOKING_ID,
      orgId: ORG_ID,
      expertUserId: EXPERT_ID,
      memberUserId: MEMBER_ID,
    }
    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({ where: () => ({ limit: async () => [row] }) }),
          }),
        })
    )
  })

  it("refuses a transcript without active ai_processing consent", async () => {
    hasActiveAiProcessingConsent.mockResolvedValue(false)
    await expect(
      upsertSessionRecord({
        bookingId: BOOKING_ID,
        actorUserId: EXPERT_ID,
        kind: "transcript",
        body: "line",
      })
    ).rejects.toEqual(new SessionRecordError("AI_CONSENT_REQUIRED"))
    expect(hasActiveAiProcessingConsent).toHaveBeenCalledWith({
      memberUserId: MEMBER_ID,
      bookingId: BOOKING_ID,
    })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("saves a transcript when consent is active", async () => {
    hasActiveAiProcessingConsent.mockResolvedValue(true)
    withAudit.mockResolvedValue({ id: "r1" })
    await upsertSessionRecord({
      bookingId: BOOKING_ID,
      actorUserId: EXPERT_ID,
      kind: "transcript",
      body: "line",
    })
    expect(withAudit).toHaveBeenCalledOnce()
  })

  it("does not check consent for notes", async () => {
    withAudit.mockResolvedValue({ id: "r1" })
    await upsertSessionRecord({
      bookingId: BOOKING_ID,
      actorUserId: EXPERT_ID,
      kind: "note",
      body: "line",
    })
    expect(hasActiveAiProcessingConsent).not.toHaveBeenCalled()
  })
})
