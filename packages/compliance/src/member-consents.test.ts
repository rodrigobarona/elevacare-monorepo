import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  memberHasConfirmedFutureBooking,
  withAudit,
  withPlatformAudit,
  withPlatformAdminContext,
} = vi.hoisted(() => ({
  memberHasConfirmedFutureBooking: vi.fn(),
  withAudit: vi.fn(),
  withPlatformAudit: vi.fn(),
  withPlatformAdminContext: vi.fn(),
}))

vi.mock("@eleva/db", () => ({
  main: {
    consents: {
      id: "id",
      kind: "kind",
      documentVersion: "document_version",
      grantedAt: "granted_at",
      withdrawnAt: "withdrawn_at",
      source: "source",
      userId: "user_id",
      orgId: "org_id",
      bookingId: "booking_id",
    },
    consentSourceEnum: { enumValues: ["funnel", "account", "import"] },
  },
  memberHasConfirmedFutureBooking,
  withPlatformAdminContext,
}))

vi.mock("@eleva/audit", () => ({
  withAudit,
  withPlatformAudit,
}))

import {
  MemberConsentConflictError,
  updateMemberConsent,
} from "./member-consents"

describe("updateMemberConsent", () => {
  beforeEach(() => {
    memberHasConfirmedFutureBooking.mockReset()
    withAudit.mockReset()
    withPlatformAudit.mockReset()
    withPlatformAdminContext.mockReset()
    withPlatformAdminContext.mockResolvedValue([])
  })

  it("returns 409-family error when withdrawing health_data_processing with a confirmed future booking", async () => {
    memberHasConfirmedFutureBooking.mockResolvedValue(true)

    await expect(
      updateMemberConsent({
        userId: "11111111-1111-4111-8111-111111111111",
        orgId: "22222222-2222-4222-8222-222222222222",
        kind: "health_data_processing",
        granted: false,
      })
    ).rejects.toBeInstanceOf(MemberConsentConflictError)

    expect(withPlatformAudit).not.toHaveBeenCalled()
  })

  it("withdraws marketing even when a confirmed future booking exists", async () => {
    memberHasConfirmedFutureBooking.mockResolvedValue(true)
    const emit = vi.fn()
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    withPlatformAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (
          tx: { update: () => { set: () => { where: typeof updateWhere } } },
          ctx: { emit: typeof emit }
        ) => Promise<void>
      ) =>
        fn(
          {
            update: () => ({
              set: () => ({ where: updateWhere }),
            }),
          },
          { emit }
        )
    )

    await updateMemberConsent({
      userId: "11111111-1111-4111-8111-111111111111",
      orgId: "22222222-2222-4222-8222-222222222222",
      kind: "marketing",
      granted: false,
    })

    expect(memberHasConfirmedFutureBooking).not.toHaveBeenCalled()
    expect(updateWhere).toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "consent",
        action: "withdrawn",
        payload: { kind: "marketing" },
      })
    )
  })
})
