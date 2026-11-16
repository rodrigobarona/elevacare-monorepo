import { beforeEach, describe, expect, it, vi } from "vitest"

const { PracticeClosureError, closeExpertPractice, reopenExpertPractice } =
  vi.hoisted(() => {
    class PracticeClosureError extends Error {
      constructor(
        readonly code: string,
        message: string,
        readonly blockers: { code: string; count: number }[] = []
      ) {
        super(message)
      }
    }
    return {
      PracticeClosureError,
      closeExpertPractice: vi.fn(),
      reopenExpertPractice: vi.fn(),
    }
  })

const signedInAt = { value: new Date() }

vi.mock("@eleva/auth", () => ({
  PracticeClosureError,
  closeExpertPractice: (...args: unknown[]) => closeExpertPractice(...args),
  reopenExpertPractice: (...args: unknown[]) => reopenExpertPractice(...args),
}))

vi.mock("@/lib/auth", () => ({
  requireRevocableApiCapability: vi.fn(async () => ({
    user: { id: "owner-1" },
    orgId: "practice-org",
    authenticatedAt: signedInAt.value,
  })),
  apiAuthFailure: vi.fn(() => null),
}))

vi.mock("@/lib/idempotency", () => ({
  withIdempotency: (_req: Request, _ctx: unknown, run: () => unknown) => run(),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "closure",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST as close } from "./route"
import { POST as reopen } from "./reopen/route"

function closeRequest(body: unknown = { confirmSlug: "patricia-mota-pt" }) {
  return close(
    new Request("http://127.0.0.1:3002/expert/closure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("POST /expert/closure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signedInAt.value = new Date()
  })

  it("asks for a fresh sign-in when the session is older than 15 minutes", async () => {
    signedInAt.value = new Date(Date.now() - 16 * 60 * 1000)
    const res = await closeRequest()
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "STEP_UP_REQUIRED" })
    expect(closeExpertPractice).not.toHaveBeenCalled()
  })

  it("refuses API keys and JWTs, which carry no sign-in moment", async () => {
    signedInAt.value = null as unknown as Date
    const res = await closeRequest()
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "STEP_UP_REQUIRED" })
  })

  it("requires the typed username", async () => {
    const res = await closeRequest({})
    expect(res.status).toBe(422)
    expect(closeExpertPractice).not.toHaveBeenCalled()
  })

  it("closes the practice for the session's workspace", async () => {
    closeExpertPractice.mockResolvedValue({
      orgId: "practice-org",
      slug: "patricia-mota-pt",
      closedAt: new Date("2026-11-16T15:00:00Z"),
      removedMembers: 1,
      cancelledInvitations: 2,
    })
    const res = await closeRequest()
    expect(res.status).toBe(200)
    expect(closeExpertPractice).toHaveBeenCalledWith({
      orgId: "practice-org",
      actorUserId: "owner-1",
      confirmSlug: "patricia-mota-pt",
    })
    expect(await res.json()).toEqual({
      practice: {
        slug: "patricia-mota-pt",
        closedAt: "2026-11-16T15:00:00.000Z",
        removedMembers: 1,
        cancelledInvitations: 2,
      },
    })
  })

  it.each([
    ["PRACTICE_CLOSURE_BLOCKED", 409],
    ["PRACTICE_ALREADY_CLOSED", 409],
    ["CLOSURE_CONFIRMATION_MISMATCH", 422],
    ["PRACTICE_OWNER_REQUIRED", 403],
    ["PRACTICE_NOT_FOUND", 404],
  ])("answers %s with %i and a stable code", async (code, status) => {
    const blockers =
      code === "PRACTICE_CLOSURE_BLOCKED"
        ? [{ code: "FUTURE_BOOKINGS", count: 2 }]
        : []
    closeExpertPractice.mockRejectedValue(
      new PracticeClosureError(code, "refused", blockers)
    )
    const res = await closeRequest()
    expect(res.status).toBe(status)
    const body = await res.json()
    expect(body).toMatchObject({ error: code, code, message: "refused" })
    if (blockers.length > 0) expect(body.blockers).toEqual(blockers)
    else expect(body).not.toHaveProperty("blockers")
  })
})

describe("POST /expert/closure/reopen", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reopens a closed practice", async () => {
    reopenExpertPractice.mockResolvedValue({
      orgId: "practice-org",
      slug: "patricia-mota-pt",
    })
    const res = await reopen(
      new Request("http://127.0.0.1:3002/expert/closure/reopen", {
        method: "POST",
      })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      practice: { slug: "patricia-mota-pt", closedAt: null },
    })
  })

  it("answers PRACTICE_NOT_CLOSED with 409", async () => {
    reopenExpertPractice.mockRejectedValue(
      new PracticeClosureError("PRACTICE_NOT_CLOSED", "open")
    )
    const res = await reopen(
      new Request("http://127.0.0.1:3002/expert/closure/reopen", {
        method: "POST",
      })
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "PRACTICE_NOT_CLOSED" })
  })
})
