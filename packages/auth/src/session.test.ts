import { describe, expect, it } from "vitest"
import { capabilitiesFor } from "./capabilities"
import { requirePermission, resolveSessionCapabilities } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

const mockSession: ElevaSession = {
  user: { id: "u1", workosUserId: "wu1", email: "a@b.c" },
  orgId: "org-1",
  workosOrgId: "workos-org-1",
  orgSlug: "test-org",
  orgType: "expert",
  productLabel: "expert",
  workosRole: "admin",
  capabilities: ["events:manage", "bookings:manage_own"],
}

describe("resolveSessionCapabilities", () => {
  const derivedExpert = capabilitiesFor("expert")

  it("uses derived capabilities when JWT org does not match picked org", () => {
    expect(
      resolveSessionCapabilities("expert", derivedExpert, {
        jwtMatchesPicked: false,
        jwtPermissions: ["appointments:view_own"],
      })
    ).toEqual(derivedExpert)
  })

  it("uses derived capabilities when JWT permissions are empty", () => {
    expect(
      resolveSessionCapabilities("expert", derivedExpert, {
        jwtMatchesPicked: true,
        jwtPermissions: [],
      })
    ).toEqual(derivedExpert)
  })

  it("falls back to derived when stale JWT lacks required expert capability", () => {
    expect(
      resolveSessionCapabilities("expert", derivedExpert, {
        jwtMatchesPicked: true,
        jwtPermissions: ["payouts:view_own"],
      })
    ).toEqual(derivedExpert)
  })

  it("trusts JWT permissions when required expert capabilities are present", () => {
    const jwtPermissions = ["events:manage", "payouts:view_own"]
    expect(
      resolveSessionCapabilities("expert", derivedExpert, {
        jwtMatchesPicked: true,
        jwtPermissions,
      })
    ).toEqual(jwtPermissions)
  })
})

describe("requirePermission", () => {
  it("throws no-session when session is null", () => {
    try {
      requirePermission(null, "events:manage")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
      expect((err as UnauthorizedError).code).toBe("no-session")
    }
  })

  it("throws missing-capability when capability absent", () => {
    try {
      requirePermission(mockSession, "audit:view_all")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError)
      expect((err as UnauthorizedError).code).toBe("missing-capability")
    }
  })

  it("passes through when capability present", () => {
    expect(() => requirePermission(mockSession, "events:manage")).not.toThrow()
  })

  it("narrows the session type after assertion", () => {
    const session: ElevaSession | null = mockSession
    requirePermission(session, "events:manage")
    expect(session.orgId).toBe("org-1")
  })
})
