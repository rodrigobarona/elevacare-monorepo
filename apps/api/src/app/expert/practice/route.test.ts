import { beforeEach, describe, expect, it, vi } from "vitest"

const updateExpertProfile = vi.fn()
const validatePractice = vi.fn()
let profile: Record<string, unknown>

vi.mock("@eleva/db", () => ({
  getExpertProfileForOrg: vi.fn(async () => profile),
  listPublishedActiveModesForExpert: vi.fn(async () => []),
  updateExpertProfile: (...args: unknown[]) => updateExpertProfile(...args),
  main: {},
}))

vi.mock("@eleva/scheduling", () => ({
  validatePracticeAgainstPublishedModes: (...args: unknown[]) =>
    validatePractice(...args),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: vi.fn(async () => ({ user: { id: "user-1" } })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "practice",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { PATCH } from "./route"

function patch(body: unknown) {
  return PATCH(
    new Request("http://127.0.0.1:3002/expert/practice", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

const BASE = {
  id: "profile-1",
  orgId: "org-1",
  practiceCountry: "PT",
  serviceCountries: ["PT"],
  languages: ["pt"],
  worldwideRemote: false,
  professionalBody: "ordem_fisioterapeutas",
  licenceNumber: "FT-0042",
  ersRegistrationNumber: "E98765",
}

describe("PATCH /expert/practice country lock", () => {
  beforeEach(() => {
    updateExpertProfile.mockReset()
    validatePractice.mockReset()
    // Stop after the checks under test, before any write.
    validatePractice.mockReturnValue([{ code: "EMPTY_LANGUAGE_LIST" }])
  })

  it("refuses a new practice country once the licence is filed", async () => {
    profile = {
      ...BASE,
      status: "approved",
      metadata: { completedSteps: ["schedule"] },
    }
    const response = await patch({
      practiceCountry: "ES",
      serviceCountries: ["ES"],
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: "PRACTICE_COUNTRY_LOCKED",
    })
  })

  it("lets a listed expert keep the same country while editing the rest", async () => {
    profile = { ...BASE, status: "active", metadata: {} }
    const response = await patch({
      practiceCountry: "pt",
      serviceCountries: ["PT", "ES"],
    })
    expect(await response.json()).not.toMatchObject({
      error: "PRACTICE_COUNTRY_LOCKED",
    })
    expect(validatePractice).toHaveBeenCalled()
  })

  it("lets an expert still in setup choose a country", async () => {
    profile = { ...BASE, status: "approved", metadata: {} }
    const response = await patch({
      practiceCountry: "ES",
      serviceCountries: ["ES"],
    })
    expect(await response.json()).not.toMatchObject({
      error: "PRACTICE_COUNTRY_LOCKED",
    })
  })
})
