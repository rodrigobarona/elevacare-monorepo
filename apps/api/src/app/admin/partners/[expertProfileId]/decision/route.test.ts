import { beforeEach, describe, expect, it, vi } from "vitest"

const decide = vi.fn()
const requireCapability = vi.fn()

vi.mock("@eleva/auth/partner-review", async () => {
  class PartnerReviewError extends Error {
    constructor(
      readonly code: string,
      readonly status: number
    ) {
      super(code)
    }
  }
  return {
    PartnerReviewError,
    decideLicenceApplication: (...args: unknown[]) => decide(...args),
  }
})

vi.mock("@/lib/auth", () => ({
  requireRevocableApiCapability: (...args: unknown[]) =>
    requireCapability(...args),
  apiAuthFailure: (err: Error) =>
    err.message === "forbidden"
      ? Response.json({ error: "forbidden" }, { status: 403 })
      : null,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "decision",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { PartnerReviewError } from "@eleva/auth/partner-review"
import { POST } from "./route"

const PROFILE_ID = "00000000-0000-4000-8000-000000000001"
const TARGET = {
  applicationId: "00000000-0000-4000-8000-000000000002",
  submittedAt: "2026-10-30T10:00:00.000Z",
}
const CHECKLIST = {
  register_checked: true,
  name_matches: true,
  ers_checked: true,
}

function post(body: unknown, profileId = PROFILE_ID) {
  return POST(
    new Request(`http://127.0.0.1:3002/admin/partners/${profileId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ expertProfileId: profileId }) }
  )
}

describe("POST /admin/partners/{expertProfileId}/decision", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // A console session that started a moment ago.
    requireCapability.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: new Date(),
    })
    decide.mockResolvedValue({ status: "approved", profileStatus: "active" })
  })

  it("is gated on a revocable applications:review session", async () => {
    requireCapability.mockRejectedValue(new Error("forbidden"))
    const res = await post({ ...TARGET, decision: "reject", reason: "x" })
    expect(res.status).toBe(403)
    expect(requireCapability).toHaveBeenCalledWith(
      expect.anything(),
      "applications:review"
    )
    expect(decide).not.toHaveBeenCalled()
  })

  it("asks a browser session that started long ago to sign in again", async () => {
    const hoursAgo = (hours: number) =>
      new Date(Date.now() - hours * 60 * 60 * 1000)
    const approve = { ...TARGET, decision: "approve", checklist: CHECKLIST }
    // Left open since yesterday: no licence is verified from it.
    requireCapability.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: hoursAgo(13),
    })
    const stale = await post(approve)
    expect(stale.status).toBe(403)
    await expect(stale.json()).resolves.toMatchObject({
      error: "STEP_UP_REQUIRED",
    })
    expect(decide).not.toHaveBeenCalled()
    // A session with no readable start is old too, not an API key.
    requireCapability.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "bearer",
      authenticatedAt: null,
    })
    expect((await post(approve)).status).toBe(403)
    // Signed in this morning, or an API key issued on purpose: decides.
    requireCapability.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "cookie",
      authenticatedAt: hoursAgo(3),
    })
    expect((await post(approve)).status).toBe(200)
    requireCapability.mockResolvedValue({
      user: { id: "staff-1" },
      authMode: "api-key",
      authenticatedAt: null,
    })
    expect((await post(approve)).status).toBe(200)
    expect(decide).toHaveBeenCalledTimes(2)
  })

  it("approves with every checklist item", async () => {
    const res = await post({
      ...TARGET,
      decision: "approve",
      checklist: CHECKLIST,
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "approved",
      profileStatus: "active",
    })
    expect(decide).toHaveBeenCalledWith({
      expertProfileId: PROFILE_ID,
      applicationId: TARGET.applicationId,
      submittedAt: new Date(TARGET.submittedAt),
      actorUserId: "staff-1",
      decision: { decision: "approve", checklist: CHECKLIST },
    })
  })

  it.each([
    ["a missing item", { register_checked: true, name_matches: true }],
    [
      "an unconfirmed item",
      { register_checked: true, name_matches: true, ers_checked: false },
    ],
    ["no checks", {}],
  ])("refuses approval with %s", async (_label, checklist) => {
    const res = await post({ ...TARGET, decision: "approve", checklist })
    expect(res.status).toBe(422)
    expect(decide).not.toHaveBeenCalled()
  })

  it.each(["needs_changes", "reject"])("%s requires a reason", async (kind) => {
    const missing = await post({ ...TARGET, decision: kind })
    expect(missing.status).toBe(422)
    const blank = await post({ ...TARGET, decision: kind, reason: "   " })
    expect(blank.status).toBe(422)
    expect(decide).not.toHaveBeenCalled()
  })

  it("trims the reason before it reaches the expert", async () => {
    decide.mockResolvedValue({
      status: "needs_changes",
      profileStatus: "approved",
    })
    const res = await post({
      ...TARGET,
      decision: "needs_changes",
      reason: "  Number not found  ",
    })
    expect(res.status).toBe(200)
    expect(decide.mock.calls[0]![0].decision).toEqual({
      decision: "needs_changes",
      reason: "Number not found",
    })
  })

  it("refuses a malformed profile id", async () => {
    const res = await post(
      { ...TARGET, decision: "reject", reason: "x" },
      "nope"
    )
    expect(res.status).toBe(422)
  })

  it("returns the domain code on a refused decision", async () => {
    const Refusal = PartnerReviewError as unknown as new (
      code: string,
      status: number
    ) => Error
    decide.mockRejectedValue(new Refusal("APPLICATION_CHANGED", 409))
    const res = await post({ ...TARGET, decision: "reject", reason: "x" })
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      code: "APPLICATION_CHANGED",
    })
  })
})
