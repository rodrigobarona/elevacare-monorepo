import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AI_PROCESSING_CONSENT_DOCUMENT,
  CONSENT_DOCUMENTS,
  CONSENT_DOCUMENT_VERSION,
  CONSENT_KINDS,
  FUNNEL_CONSENT_KINDS,
  assertConsentVersionsApprovedForDeployment,
  hashGuestEmail,
  isDraftConsentVersion,
  requiredConsentVersions,
  validateFunnelConsents,
} from "./consents"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("CONSENT_DOCUMENTS", () => {
  it("records a version and locale URLs for every funnel kind", () => {
    for (const kind of FUNNEL_CONSENT_KINDS) {
      const doc = CONSENT_DOCUMENTS[kind]
      expect(doc.version).toBe(CONSENT_DOCUMENT_VERSION)
      expect(doc.urls.en).toMatch(/^\/legal\//)
      expect(doc.urls.pt).toMatch(/^\/pt\/legal\//)
      expect(doc.urls.es).toMatch(/^\/es\/legal\//)
    }
  })

  it("records a version and locale URLs for ai_processing", () => {
    expect(AI_PROCESSING_CONSENT_DOCUMENT.version).toBe(
      CONSENT_DOCUMENT_VERSION
    )
    expect(AI_PROCESSING_CONSENT_DOCUMENT.urls.en).toBe("/legal/ai-processing")
    expect(AI_PROCESSING_CONSENT_DOCUMENT.urls.pt).toBe(
      "/pt/legal/ai-processing"
    )
  })

  it("exposes required versions for reserve-time checks", () => {
    expect(requiredConsentVersions({ VERCEL_ENV: "preview" })).toEqual({
      terms: CONSENT_DOCUMENT_VERSION,
      privacy: CONSENT_DOCUMENT_VERSION,
      health_data_processing: CONSENT_DOCUMENT_VERSION,
    })
  })

  it("treats only the dev- prefix as a draft version", () => {
    expect(isDraftConsentVersion(CONSENT_DOCUMENT_VERSION)).toBe(false)
    expect(isDraftConsentVersion("dev-2026-09-09")).toBe(true)
    expect(isDraftConsentVersion("2026-09-21")).toBe(false)
  })

  it("allows the published consent version on the production Vercel environment", () => {
    expect(() =>
      assertConsentVersionsApprovedForDeployment({ VERCEL_ENV: "production" })
    ).not.toThrow()
    expect(requiredConsentVersions({ VERCEL_ENV: "production" })).toEqual({
      terms: CONSENT_DOCUMENT_VERSION,
      privacy: CONSENT_DOCUMENT_VERSION,
      health_data_processing: CONSENT_DOCUMENT_VERSION,
    })
  })

  it("accepts the current funnel versions and rejects a stale one", () => {
    const grants = FUNNEL_CONSENT_KINDS.map((kind) => ({
      kind,
      version: CONSENT_DOCUMENT_VERSION,
    }))
    expect(validateFunnelConsents(grants, { VERCEL_ENV: "preview" })).toEqual({
      ok: true,
    })
    expect(
      validateFunnelConsents(
        grants.map((grant) =>
          grant.kind === "terms" ? { ...grant, version: "stale" } : grant
        ),
        { VERCEL_ENV: "preview" }
      )
    ).toEqual({ ok: false, error: "CONSENT_VERSION_OUTDATED" })
  })

  it("does not require marketing on the booking funnel", () => {
    expect(CONSENT_KINDS).toContain("marketing")
    expect(FUNNEL_CONSENT_KINDS).not.toContain("marketing")
    const grants = FUNNEL_CONSENT_KINDS.map((kind) => ({
      kind,
      version: CONSENT_DOCUMENT_VERSION,
    }))
    expect(validateFunnelConsents(grants, { VERCEL_ENV: "preview" })).toEqual({
      ok: true,
    })
  })

  it("hashes guest emails with HMAC-SHA256", () => {
    const secret = "a".repeat(32)
    const hash = hashGuestEmail("Ada@Eleva.care", secret)
    expect(hash).toHaveLength(64)
    expect(hash).toBe(hashGuestEmail("ada@eleva.care", secret))
    expect(() => hashGuestEmail("ada@eleva.care", "short-key")).toThrow(
      /CONSENT_HASH_KEY/
    )
    vi.stubEnv("CONSENT_HASH_KEY", "")
    expect(() => hashGuestEmail("ada@eleva.care")).toThrow(/CONSENT_HASH_KEY/)
  })
})
