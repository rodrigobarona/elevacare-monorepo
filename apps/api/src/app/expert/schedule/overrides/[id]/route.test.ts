import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  withAudit: vi.fn(),
  deleteDateOverride: vi.fn(),
  logError: vi.fn(),
}))

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
vi.mock("@eleva/audit", () => ({ withAudit: mocks.withAudit }))
vi.mock("@eleva/observability", () => ({ logError: mocks.logError }))
vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: vi.fn(async () => ({
    id: "profile-1",
    orgId: "org-1",
  })),
  deleteDateOverride: mocks.deleteDateOverride,
  main: { dateOverrides: { id: "id", scheduleId: "schedule_id" } },
}))

import { DELETE } from "./route"

const ID = "6f1c2a0e-9a4b-4c1d-8e2f-3b5a7c9d1e0f"
const remove = (id: string) =>
  DELETE(
    new Request(`https://api.test/expert/schedule/overrides/${id}`, {
      method: "DELETE",
    }),
    {
      params: Promise.resolve({ id }),
    }
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.withAudit.mockResolvedValue(undefined)
})

describe("DELETE /expert/schedule/overrides/{id}", () => {
  it.each(["not-an-id", "1 or 1=1", "../other", ""])(
    "refuses %j before it reaches a query",
    async (id) => {
      const response = await remove(id)
      expect(response.status).toBe(422)
      await expect(response.json()).resolves.toMatchObject({
        error: "invalid_body",
      })
      expect(mocks.withAudit).not.toHaveBeenCalled()
    }
  )

  it("removes an override named by a well-formed id", async () => {
    const response = await remove(ID)
    expect(response.status).toBe(200)
    expect(mocks.withAudit).toHaveBeenCalledTimes(1)
  })

  it("keeps the error's own words in the log, not in the answer", async () => {
    mocks.withAudit.mockRejectedValue(
      new Error('Failed query: delete from "date_overrides" where id = $1')
    )
    const response = await remove(ID)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "internal",
    })
    expect(mocks.logError).toHaveBeenCalledTimes(1)
  })
})
