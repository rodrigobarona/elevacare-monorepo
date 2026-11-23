import { beforeEach, describe, expect, it, vi } from "vitest"

const listCalendarIntegrations = vi.hoisted(() => vi.fn(async () => []))

vi.mock("@/lib/auth", () => ({
  apiAuthFailure: () => null,
  requireApiCapability: vi.fn(async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
  })),
}))
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "user:user-1",
  RATE_LIMITS: { authenticated: {} },
}))
vi.mock("@/lib/cors", () => ({ corsHeaders: () => ({}) }))
vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))
vi.mock("@eleva/auth", () => ({
  releaseCalendarAccount: vi.fn(),
  revokeProviderGrant: vi.fn(),
}))
vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: vi.fn(async () => ({
    id: "profile-1",
    orgId: "org-1",
  })),
  listCalendarIntegrations,
  disconnectIntegration: vi.fn(),
}))

import { DELETE } from "./route"

const remove = (id: string) =>
  DELETE(
    new Request(`https://api.test/expert/integrations/${id}`, {
      method: "DELETE",
    }),
    {
      params: Promise.resolve({ id }),
    }
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe("DELETE /expert/integrations/{id}", () => {
  it("refuses an id that is not well formed, before it lists any integration", async () => {
    const response = await remove("google-calendar")
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_body",
    })
    expect(listCalendarIntegrations).not.toHaveBeenCalled()
  })

  it("answers 404 for a well-formed id that is not the caller's", async () => {
    const response = await remove("6f1c2a0e-9a4b-4c1d-8e2f-3b5a7c9d1e0f")
    expect(response.status).toBe(404)
    expect(listCalendarIntegrations).toHaveBeenCalledTimes(1)
  })
})
