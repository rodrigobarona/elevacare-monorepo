import { describe, expect, it } from "vitest"
import {
  CONSENT_DOCUMENTS,
  CONSENT_DOCUMENT_VERSION,
  CONSENT_KINDS,
  assertConsentVersionsApprovedForDeployment,
  isDraftConsentVersion,
  requiredConsentVersions,
} from "./consents"

describe("CONSENT_DOCUMENTS", () => {
  it("records a version and locale URLs for every funnel kind", () => {
    for (const kind of CONSENT_KINDS) {
      const doc = CONSENT_DOCUMENTS[kind]
      expect(doc.version).toBe(CONSENT_DOCUMENT_VERSION)
      expect(doc.urls.en).toMatch(/^\/legal\//)
      expect(doc.urls.pt).toMatch(/^\/pt\/legal\//)
      expect(doc.urls.es).toMatch(/^\/es\/legal\//)
    }
  })

  it("exposes required versions for reserve-time checks", () => {
    expect(requiredConsentVersions({ VERCEL_ENV: "preview" })).toEqual({
      terms: CONSENT_DOCUMENT_VERSION,
      privacy: CONSENT_DOCUMENT_VERSION,
      health_data_processing: CONSENT_DOCUMENT_VERSION,
    })
  })

  it("treats the working pre-launch version as a draft", () => {
    expect(isDraftConsentVersion(CONSENT_DOCUMENT_VERSION)).toBe(true)
    expect(isDraftConsentVersion("2026-09-21")).toBe(false)
  })

  it("refuses draft consent versions on the production Vercel environment", () => {
    expect(() =>
      assertConsentVersionsApprovedForDeployment({ VERCEL_ENV: "production" })
    ).toThrow(/cannot accept production consent/)
    expect(() => requiredConsentVersions({ VERCEL_ENV: "production" })).toThrow(
      /cannot accept production consent/
    )
  })
})
