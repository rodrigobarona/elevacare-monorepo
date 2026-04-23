import { describe, expect, it } from "vitest"
import { requirePermission } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

const mockSession: ElevaSession = {
  user: { id: "u1", workosUserId: "wu1", email: "a@b.c" },
  orgId: "org-1",
  workosOrgId: "workos-org-1",
  productLabel: "expert",
  workosRole: "admin",
  capabilities: ["events:manage", "bookings:manage_own"],
}

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
    // Post-assertion, session is ElevaSession (not null).
    expect(session.orgId).toBe("org-1")
  })
})
