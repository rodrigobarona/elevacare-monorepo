import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  memberHasConfirmedFutureBooking,
  lockMemberHealthConsentInvariant,
  withAudit,
  withPlatformAudit,
  withPlatformAdminContext,
} = vi.hoisted(() => ({
  memberHasConfirmedFutureBooking: vi.fn(),
  lockMemberHealthConsentInvariant: vi.fn(),
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
  lockMemberHealthConsentInvariant,
  withPlatformAdminContext,
}))

vi.mock("@eleva/audit", () => ({
  withAudit,
  withPlatformAudit,
}))

import {
  MemberConsentConflictError,
  pickLatestConsentPerKind,
  updateMemberConsent,
} from "./member-consents"

describe("pickLatestConsentPerKind", () => {
  it("prefers an older active grant over a newer withdrawn row", () => {
    const activeGrantedAt = new Date("2026-01-01T00:00:00.000Z")
    const withdrawnGrantedAt = new Date("2026-06-01T00:00:00.000Z")
    const latest = pickLatestConsentPerKind([
      {
        kind: "health_data_processing",
        documentVersion: "dev-2026-09-09",
        grantedAt: withdrawnGrantedAt,
        withdrawnAt: new Date("2026-06-02T00:00:00.000Z"),
        source: "funnel",
      },
      {
        kind: "health_data_processing",
        documentVersion: "dev-2026-09-09",
        grantedAt: activeGrantedAt,
        withdrawnAt: null,
        source: "account",
      },
    ])
    expect(latest.get("health_data_processing")).toEqual({
      kind: "health_data_processing",
      version: "dev-2026-09-09",
      grantedAt: activeGrantedAt,
      withdrawnAt: null,
      source: "account",
    })
  })
})

describe("updateMemberConsent", () => {
  beforeEach(() => {
    memberHasConfirmedFutureBooking.mockReset()
    lockMemberHealthConsentInvariant.mockReset()
    withAudit.mockReset()
    withPlatformAudit.mockReset()
    withPlatformAdminContext.mockReset()
    withPlatformAdminContext.mockResolvedValue([])
    lockMemberHealthConsentInvariant.mockResolvedValue(undefined)
  })

  it("returns 409-family error when withdrawing health_data_processing with a confirmed future booking", async () => {
    memberHasConfirmedFutureBooking.mockResolvedValue(true)
    withPlatformAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (
          tx: { execute: () => Promise<void> },
          ctx: { emit: ReturnType<typeof vi.fn> }
        ) => Promise<void>
      ) => fn({ execute: async () => undefined }, { emit: vi.fn() })
    )

    await expect(
      updateMemberConsent({
        userId: "11111111-1111-4111-8111-111111111111",
        orgId: "22222222-2222-4222-8222-222222222222",
        kind: "health_data_processing",
        granted: false,
      })
    ).rejects.toBeInstanceOf(MemberConsentConflictError)

    expect(lockMemberHealthConsentInvariant).toHaveBeenCalled()
    expect(memberHasConfirmedFutureBooking).toHaveBeenCalled()
  })

  it("withdraws marketing even when a confirmed future booking exists", async () => {
    memberHasConfirmedFutureBooking.mockResolvedValue(true)
    const emit = vi.fn()
    const returning = vi.fn().mockResolvedValue([{ id: "consent-1" }])
    withPlatformAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (
          tx: {
            update: () => {
              set: () => { where: () => { returning: typeof returning } }
            }
          },
          ctx: { emit: typeof emit }
        ) => Promise<void>
      ) =>
        fn(
          {
            update: () => ({
              set: () => ({ where: () => ({ returning }) }),
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
    expect(returning).toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "consent",
        action: "withdrawn",
        entityId: "consent-1",
        payload: { kind: "marketing", ids: ["consent-1"] },
      })
    )
  })
})
