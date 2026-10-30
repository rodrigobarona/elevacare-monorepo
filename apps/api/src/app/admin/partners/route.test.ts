import { beforeEach, describe, expect, it, vi } from "vitest"

const requireCapability = vi.fn()
const listQueue = vi.fn()
const getReview = vi.fn()

vi.mock("@eleva/db", () => ({
  listLicenceReviewQueue: () => listQueue(),
  getLicenceReview: (...args: unknown[]) => getReview(...args),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: (...args: unknown[]) => requireCapability(...args),
  apiAuthFailure: (err: Error) =>
    err.message === "forbidden"
      ? Response.json({ error: "forbidden" }, { status: 403 })
      : null,
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "partners",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { GET as getDetail } from "./[expertProfileId]/route"
import { GET as getQueue } from "./route"

const PROFILE_ID = "00000000-0000-4000-8000-000000000001"
const URL = "http://127.0.0.1:3002/admin/partners"

function detail(id = PROFILE_ID) {
  return getDetail(new Request(`${URL}/${id}`), {
    params: Promise.resolve({ expertProfileId: id }),
  })
}

describe("GET /admin/partners", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireCapability.mockResolvedValue({ user: { id: "staff-1" } })
  })

  it("refuses non-staff sessions", async () => {
    requireCapability.mockRejectedValue(new Error("forbidden"))
    expect((await getQueue(new Request(URL))).status).toBe(403)
    expect((await detail()).status).toBe(403)
    expect(requireCapability).toHaveBeenCalledWith(
      expect.anything(),
      "applications:review"
    )
    expect(listQueue).not.toHaveBeenCalled()
    expect(getReview).not.toHaveBeenCalled()
  })

  it("lists the queue with listed profiles that were never verified", async () => {
    listQueue.mockResolvedValue([
      {
        expertProfileId: PROFILE_ID,
        displayName: "Ana Mota",
        username: "fisiomota",
        profileStatus: "active",
        reviewState: "needs_verification",
        professionalBody: null,
        waitingSince: new Date("2026-09-01T10:00:00.000Z"),
      },
    ])
    const res = await getQueue(new Request(URL))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          expertProfileId: PROFILE_ID,
          displayName: "Ana Mota",
          username: "fisiomota",
          profileStatus: "active",
          reviewState: "needs_verification",
          professionalBody: null,
          waitingSince: "2026-09-01T10:00:00.000Z",
        },
      ],
    })
  })

  it("returns the licence snapshot staff check", async () => {
    getReview.mockResolvedValue({
      profile: {
        id: PROFILE_ID,
        displayName: "Ana Mota",
        username: "fisiomota",
        status: "approved",
      },
      email: "ana@example.test",
      reviewState: "pending",
      application: {
        id: "00000000-0000-4000-8000-000000000002",
        status: "pending",
        professionalBody: "ordem_fisioterapeutas",
        licenceNumber: "FT-0042",
        ersRegistrationNumber: "E98765",
        submittedAt: new Date("2026-10-30T10:00:00.000Z"),
        reviewedAt: null,
        reason: null,
      },
    })
    const res = await detail()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      reviewState: "pending",
      application: { licenceNumber: "FT-0042" },
    })
  })

  it("returns 404 for an unknown profile and 422 for a bad id", async () => {
    getReview.mockResolvedValue(null)
    expect((await detail()).status).toBe(404)
    expect((await detail("nope")).status).toBe(422)
  })
})
