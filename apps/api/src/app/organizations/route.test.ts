import { beforeEach, describe, expect, it, vi } from "vitest"

const createElevaOrganization = vi.fn()
const findOwnedExpertPractice = vi.fn()

vi.mock("@eleva/auth", () => ({
  createElevaOrganization: (...args: unknown[]) =>
    createElevaOrganization(...args),
  findOwnedExpertPractice: (...args: unknown[]) =>
    findOwnedExpertPractice(...args),
  EXPERT_PRACTICE_EXISTS: "EXPERT_PRACTICE_EXISTS",
  UnauthorizedError: class UnauthorizedError extends Error {},
}))

vi.mock("@eleva/billing/server", () => ({
  provisionOrgBilling: vi.fn(async () => undefined),
}))

vi.mock("@eleva/db", () => ({ getOrganizationBySlug: vi.fn() }))

vi.mock("@/lib/auth", () => ({
  requirePrivilegedApiAuth: vi.fn(async () => ({
    user: { id: "user-1", email: "patricia@example.test" },
  })),
  requireApiAuth: vi.fn(),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/bot-protection", () => ({ checkBot: vi.fn(async () => null) }))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "organizations",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

function create(type: "expert" | "team" | "academy") {
  return POST(
    new Request("http://127.0.0.1:3002/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Second practice", type }),
    })
  )
}

const practice = {
  orgId: "practice-org",
  slug: "patricia-mota-pt",
  name: "Patricia Mota PT",
}

describe("POST /organizations — one expert practice per person", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createElevaOrganization.mockResolvedValue({
      orgId: "new-org",
      slug: "second-practice",
      created: true,
    })
  })

  it("answers 409 and names the practice the owner already has", async () => {
    findOwnedExpertPractice.mockResolvedValue(practice)
    const response = await create("expert")
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "EXPERT_PRACTICE_EXISTS",
      code: "EXPERT_PRACTICE_EXISTS",
      slug: "patricia-mota-pt",
      path: "/expert/patricia-mota-pt",
    })
    expect(findOwnedExpertPractice).toHaveBeenCalledWith("user-1")
    expect(createElevaOrganization).not.toHaveBeenCalled()
  })

  it("creates a first practice for someone who owns none", async () => {
    findOwnedExpertPractice.mockResolvedValue(null)
    const response = await create("expert")
    expect(response.status).toBe(201)
    expect(createElevaOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "expert" })
    )
  })

  it("still lets an expert create a team or an academy", async () => {
    findOwnedExpertPractice.mockResolvedValue(practice)
    for (const type of ["team", "academy"] as const) {
      const response = await create(type)
      expect(response.status).toBe(201)
    }
    expect(findOwnedExpertPractice).not.toHaveBeenCalled()
  })
})
