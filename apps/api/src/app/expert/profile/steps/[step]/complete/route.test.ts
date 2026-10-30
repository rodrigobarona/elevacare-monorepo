import { beforeEach, describe, expect, it, vi } from "vitest"

const emit = vi.fn()
const updateExpertProfile = vi.fn()
const submitPartnerApplication = vi.fn()
let profile: Record<string, unknown>

const LICENCE = {
  professionalBody: "ordem_psicologos",
  licenceNumber: "12345",
  ersRegistrationNumber: "E123456",
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    orgId: "org-1",
    status: "approved",
    practiceCountry: "PT",
    languages: ["pt"],
    metadata: {
      practiceDeclaredAt: "2026-10-01T00:00:00.000Z",
      completedSteps: ["profile", "practice", "connect", "invoicing"],
    },
    invoicingSetupStatus: "manual_acknowledged",
    stripeIdentityStatus: "verified",
    timezone: "Europe/Lisbon",
    ...LICENCE,
    ...overrides,
  }
}

vi.mock("@eleva/db", () => ({
  getExpertProfileByUserId: vi.fn(async () => profile),
  getOrCreateDefaultSchedule: vi.fn(async () => undefined),
  updateExpertProfile: (...args: unknown[]) => updateExpertProfile(...args),
  main: {
    expertProfiles: { id: "id", metadata: "metadata", status: "status" },
  },
}))

vi.mock("@eleva/db/queries/partner-applications", () => ({
  _submitPartnerApplication: (...args: unknown[]) =>
    submitPartnerApplication(...args),
}))

const tx = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => ({
          for: async () => [
            { metadata: profile.metadata, status: profile.status },
          ],
        }),
      }),
    }),
  }),
}

vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: typeof emit }) => Promise<unknown>
  ) => fn(tx, { emit }),
}))

vi.mock("@eleva/auth", () => ({
  isExpertInvoicingChoiceComplete: () => true,
}))

vi.mock("@eleva/flags", () => ({ getFlag: vi.fn(async () => false) }))

vi.mock("@/lib/bot-protection", () => ({ checkBot: vi.fn(async () => null) }))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: vi.fn(async () => ({ user: { id: "user-1" } })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "steps",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { POST } from "./route"

function complete(step: string) {
  return POST(
    new Request(`http://127.0.0.1:3002/expert/profile/steps/${step}/complete`, {
      method: "POST",
    }),
    { params: Promise.resolve({ step }) }
  )
}

describe("POST /expert/profile/steps/schedule/complete", () => {
  beforeEach(() => {
    emit.mockReset()
    updateExpertProfile.mockReset()
    submitPartnerApplication.mockReset()
    submitPartnerApplication.mockResolvedValue({
      application: { id: "app-1", professionalBody: "ordem_psicologos" },
      refreshed: false,
    })
    profile = baseProfile()
  })

  it("files a pending application and keeps the profile approved", async () => {
    const response = await complete("schedule")

    expect(response.status).toBe(200)
    expect(submitPartnerApplication).toHaveBeenCalledWith(tx, {
      orgId: "org-1",
      expertProfileId: "profile-1",
      licence: LICENCE,
    })
    const update = updateExpertProfile.mock.calls[0]?.[2] as Record<
      string,
      unknown
    >
    expect(update).not.toHaveProperty("status")
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "partner_application",
        action: "submitted",
        entityId: "app-1",
      })
    )
  })

  it("refuses to finish without a licence", async () => {
    profile = baseProfile({ ersRegistrationNumber: null })
    const response = await complete("schedule")

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "LICENCE_REQUIRED" })
    expect(submitPartnerApplication).not.toHaveBeenCalled()
    expect(updateExpertProfile).not.toHaveBeenCalled()
  })

  it("leaves an active profile active without filing an application", async () => {
    profile = baseProfile({ status: "active", licenceNumber: null })
    const response = await complete("schedule")

    expect(response.status).toBe(200)
    expect(submitPartnerApplication).not.toHaveBeenCalled()
    const update = updateExpertProfile.mock.calls[0]?.[2] as Record<
      string,
      unknown
    >
    expect(update).not.toHaveProperty("status")
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "expert_profile", action: "updated" })
    )
  })

  it("does not file on earlier steps", async () => {
    const response = await complete("connect")

    expect(response.status).toBe(200)
    expect(submitPartnerApplication).not.toHaveBeenCalled()
  })
})
