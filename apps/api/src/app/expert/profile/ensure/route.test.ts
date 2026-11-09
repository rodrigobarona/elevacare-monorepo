import { beforeEach, describe, expect, it, vi } from "vitest"

const ensureExpertProfileForOrg = vi.fn()
const listAuthOrganizations = vi.fn()

vi.mock("@eleva/auth", () => ({
  ensureExpertProfileForOrg: (...args: unknown[]) =>
    ensureExpertProfileForOrg(...args),
  listAuthOrganizations: (...args: unknown[]) => listAuthOrganizations(...args),
}))

// The session's active workspace is the member's Space, as right after a
// switch while the browser still holds the old session cache.
vi.mock("@/lib/auth", () => ({
  requireApiAuth: vi.fn(async () => ({
    user: { id: "user-1" },
    orgId: "space-org",
  })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/bot-protection", () => ({ checkBot: vi.fn(async () => null) }))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "ensure",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

function ensure(orgSlug: string) {
  return POST(
    new Request("http://127.0.0.1:3002/expert/profile/ensure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgSlug, displayName: "Patricia Mota" }),
    })
  )
}

describe("POST /expert/profile/ensure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAuthOrganizations.mockResolvedValue([
      { orgId: "space-org", orgSlug: "space-abc", productLabel: "member" },
      {
        orgId: "practice-org",
        orgSlug: "patricia-mota-pt",
        productLabel: "expert",
      },
    ])
    ensureExpertProfileForOrg.mockResolvedValue({
      profile: {
        id: "profile-1",
        orgId: "practice-org",
        userId: "user-1",
        username: "patricia-mota-pt",
        displayName: "Patricia Mota",
        status: "approved",
        metadata: {},
      },
      created: true,
    })
  })

  it("creates the profile in the named practice, not the active Space", async () => {
    const response = await ensure("patricia-mota-pt")
    expect(response.status).toBe(200)
    expect(ensureExpertProfileForOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "practice-org",
        orgSlug: "patricia-mota-pt",
      })
    )
  })

  it("refuses a workspace where the person is not an expert", async () => {
    const response = await ensure("space-abc")
    expect(response.status).toBe(403)
    expect(ensureExpertProfileForOrg).not.toHaveBeenCalled()
  })

  it("refuses a workspace the person does not belong to", async () => {
    const response = await ensure("someone-else")
    expect(response.status).toBe(403)
    expect(ensureExpertProfileForOrg).not.toHaveBeenCalled()
  })
})
