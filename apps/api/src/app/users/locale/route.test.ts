import { beforeEach, describe, expect, it, vi } from "vitest"

const updateUserLocale = vi.fn()
const requireApiAuth = vi.fn()

vi.mock("@eleva/auth", () => ({
  updateUserLocale: (...args: unknown[]) => updateUserLocale(...args),
}))

vi.mock("@/lib/auth", () => ({
  requireApiAuth: (...args: unknown[]) => requireApiAuth(...args),
  apiAuthFailure: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
  ),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "locale",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { PUT } from "./route"

function put(body: unknown) {
  return PUT(
    new Request("http://127.0.0.1:3002/users/locale", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("PUT /users/locale", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // An expert in their practice: PATCH /me would refuse this session.
    requireApiAuth.mockResolvedValue({
      user: { id: "user-1" },
      orgId: "practice-org",
      productLabel: "expert",
    })
    updateUserLocale.mockResolvedValue(undefined)
  })

  it("saves the language for an expert workspace session", async () => {
    const response = await put({ locale: "en" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(updateUserLocale).toHaveBeenCalledWith({
      userId: "user-1",
      orgId: "practice-org",
      locale: "en",
    })
  })

  it("rejects a language Eleva does not offer", async () => {
    const response = await put({ locale: "fr" })
    expect(response.status).toBe(422)
    expect(updateUserLocale).not.toHaveBeenCalled()
  })

  it("refuses an unsigned caller", async () => {
    requireApiAuth.mockRejectedValue(new Error("unauthorized"))
    const response = await put({ locale: "en" })
    expect(response.status).toBe(401)
    expect(updateUserLocale).not.toHaveBeenCalled()
  })
})
