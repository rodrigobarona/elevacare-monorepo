import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("platform audit org", () => {
  it("returns null when unset", async () => {
    vi.stubEnv("ELEVA_PLATFORM_AUDIT_ORG_ID", "")
    const { getPlatformAuditOrgId } = await import("./platform-audit-org")
    expect(getPlatformAuditOrgId()).toBeNull()
  })

  it("returns a trimmed UUID when configured", async () => {
    const id = "00000000-0000-4000-8000-000000000099"
    vi.stubEnv("ELEVA_PLATFORM_AUDIT_ORG_ID", `  ${id}  `)
    const { getPlatformAuditOrgId, resolveNotificationAuditOrgId } =
      await import("./platform-audit-org")
    expect(getPlatformAuditOrgId()).toBe(id)
    expect(resolveNotificationAuditOrgId(null)).toBe(id)
    expect(resolveNotificationAuditOrgId(undefined)).toBe(id)
  })

  it("prefers the delivery org when present", async () => {
    vi.stubEnv(
      "ELEVA_PLATFORM_AUDIT_ORG_ID",
      "00000000-0000-4000-8000-000000000099"
    )
    const tenant = "00000000-0000-4000-8000-000000000010"
    const { resolveNotificationAuditOrgId } =
      await import("./platform-audit-org")
    expect(resolveNotificationAuditOrgId(tenant)).toBe(tenant)
  })
})
