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

const emitted: unknown[] = []

beforeEach(() => {
  vi.clearAllMocks()
  emitted.length = 0
  // Runs the route's own write with a transaction that finds the override.
  mocks.withAudit.mockImplementation(
    async (
      _options: unknown,
      write: (tx: unknown, ctx: { emit: (event: unknown) => void }) => unknown
    ) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ scheduleId: "schedule-1" }],
            }),
          }),
        }),
      }
      return write(tx, { emit: (event) => void emitted.push(event) })
    }
  )
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

  it("removes an override named by a well-formed id, and records it", async () => {
    const response = await remove(ID)
    expect(response.status).toBe(200)
    expect(mocks.withAudit).toHaveBeenCalledWith(
      { orgId: "org-1", actorUserId: "user-1" },
      expect.any(Function)
    )
    // The caller's own practice and profile, and the parsed id.
    expect(mocks.deleteDateOverride).toHaveBeenCalledWith(
      "org-1",
      ID,
      "profile-1",
      expect.anything()
    )
    expect(emitted).toEqual([
      {
        entity: "schedule",
        action: "updated",
        entityId: "schedule-1",
        payload: { action: "override_removed", overrideId: ID },
      },
    ])
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
