import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetEnvCache } from "@eleva/config/env"

const withAudit = vi.hoisted(() => vi.fn())
const withPlatformAudit = vi.hoisted(() => vi.fn())

vi.mock("@eleva/audit", async () => {
  const actual =
    await vi.importActual<typeof import("@eleva/audit")>("@eleva/audit")
  return {
    ...actual,
    withAudit,
    withPlatformAudit,
  }
})

const originalPlatformAuditOrgId = process.env.ELEVA_PLATFORM_AUDIT_ORG_ID

beforeEach(() => {
  process.env.ELEVA_PLATFORM_AUDIT_ORG_ID = ""
  resetEnvCache()
})

afterEach(() => {
  vi.clearAllMocks()
  if (originalPlatformAuditOrgId === undefined) {
    delete process.env.ELEVA_PLATFORM_AUDIT_ORG_ID
  } else {
    process.env.ELEVA_PLATFORM_AUDIT_ORG_ID = originalPlatformAuditOrgId
  }
  resetEnvCache()
})

describe("recordNotificationDeliveryAudit", () => {
  it("no-ops when delivery and platform org are both unset", async () => {
    const { recordNotificationDeliveryAudit } = await import("./audit-delivery")
    await recordNotificationDeliveryAudit({
      deliveryOrgId: null,
      deliveryId: "d1",
      kind: "auth.magic_link",
      channel: "email",
      action: "sent",
    })
    expect(withAudit).not.toHaveBeenCalled()
    expect(withPlatformAudit).not.toHaveBeenCalled()
  })

  it("uses withPlatformAudit for platform-scoped deliveries", async () => {
    process.env.ELEVA_PLATFORM_AUDIT_ORG_ID =
      "00000000-0000-4000-8000-000000000099"
    resetEnvCache()
    withPlatformAudit.mockImplementation(async (_opts, fn) =>
      fn({}, { emit: vi.fn() })
    )
    const { recordNotificationDeliveryAudit } = await import("./audit-delivery")
    await recordNotificationDeliveryAudit({
      deliveryOrgId: null,
      recipientUserId: "user-1",
      deliveryId: "d1",
      kind: "auth.magic_link",
      channel: "email",
      action: "sent",
    })
    expect(withPlatformAudit).toHaveBeenCalledWith(
      {
        orgId: "00000000-0000-4000-8000-000000000099",
        actorUserId: null,
      },
      expect.any(Function)
    )
  })

  it("uses withAudit for tenant-scoped deliveries", async () => {
    withAudit.mockImplementation(async (_opts, fn) => fn({}, { emit: vi.fn() }))
    const tenant = "00000000-0000-4000-8000-000000000010"
    const { recordNotificationDeliveryAudit } = await import("./audit-delivery")
    await recordNotificationDeliveryAudit({
      deliveryOrgId: tenant,
      deliveryId: "d1",
      kind: "booking.confirmed",
      channel: "email",
      action: "sent",
    })
    expect(withAudit).toHaveBeenCalledWith(
      { orgId: tenant, actorUserId: null },
      expect.any(Function)
    )
  })
})
