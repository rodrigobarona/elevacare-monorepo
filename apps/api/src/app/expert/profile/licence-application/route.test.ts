import { beforeEach, describe, expect, it, vi } from "vitest"

const emit = vi.fn()
const updateExpertProfile = vi.fn()
const submitPartnerApplication = vi.fn()
let profile: Record<string, unknown> | null
let latest: Record<string, unknown> | null

const LICENCE = {
  professionalBody: "ordem_fisioterapeutas",
  licenceNumber: "FT-0042",
  ersRegistrationNumber: "E98765",
}

const APPLICATION = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "pending",
  ...LICENCE,
  submittedAt: new Date("2026-10-30T10:00:00.000Z"),
  reviewedAt: null,
  reason: null,
}

vi.mock("@eleva/db", () => ({
  getExpertProfileByUserId: vi.fn(async () => profile),
  getLatestPartnerApplication: vi.fn(async () => latest),
  updateExpertProfile: (...args: unknown[]) => updateExpertProfile(...args),
}))

vi.mock("@eleva/db/queries/partner-applications", () => ({
  _submitPartnerApplication: (...args: unknown[]) =>
    submitPartnerApplication(...args),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: typeof emit }) => Promise<unknown>
  ) => fn({}, { emit }),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: vi.fn(async () => ({ user: { id: "user-1" } })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "licence",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { GET, POST } from "./route"

const URL = "http://127.0.0.1:3002/expert/profile/licence-application"

function submit(body: unknown) {
  return POST(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("/expert/profile/licence-application", () => {
  beforeEach(() => {
    emit.mockReset()
    updateExpertProfile.mockReset()
    submitPartnerApplication.mockReset()
    submitPartnerApplication.mockResolvedValue({
      application: APPLICATION,
      refreshed: false,
    })
    profile = {
      id: "profile-1",
      orgId: "org-1",
      status: "active",
      metadata: {},
    }
    latest = null
  })

  it("returns null before anything was filed", async () => {
    const response = await GET(new Request(URL))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ application: null })
  })

  it("lets an unverified active profile submit and keeps it active", async () => {
    const response = await submit(LICENCE)

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      application: { status: "pending", licenceNumber: "FT-0042" },
    })
    expect(updateExpertProfile).toHaveBeenCalledWith(
      "profile-1",
      "org-1",
      LICENCE,
      {}
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "partner_application",
        action: "submitted",
      })
    )
  })

  it("resubmits after needs_changes on a finished approved profile", async () => {
    profile = {
      ...profile,
      status: "approved",
      metadata: { completedSteps: ["schedule"] },
    }
    latest = { ...APPLICATION, status: "needs_changes", reason: "Typo" }
    const response = await submit(LICENCE)
    expect(response.status).toBe(201)
  })

  it("locks a verified licence", async () => {
    latest = { ...APPLICATION, status: "approved" }
    const response = await submit(LICENCE)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "LICENCE_LOCKED" })
    expect(submitPartnerApplication).not.toHaveBeenCalled()
  })

  it("sends an unfinished setup back to the wizard", async () => {
    profile = { ...profile, status: "approved", metadata: {} }
    const response = await submit(LICENCE)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "SETUP_INCOMPLETE" })
  })

  it("refuses a suspended profile", async () => {
    profile = { ...profile, status: "suspended" }
    const response = await submit(LICENCE)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "PROFILE_NOT_ELIGIBLE",
    })
  })

  it("rejects an unknown professional body", async () => {
    const response = await submit({ ...LICENCE, professionalBody: "coaches" })
    expect(response.status).toBe(422)
  })
})
