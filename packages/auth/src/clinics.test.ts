import { describe, expect, it } from "vitest"
import { ClinicError, clinicSlugFor, normalizeClinicTaxId } from "./clinics"

const ORG_ID = "3ecf8117-8b32-4f32-9355-d46c5497e08c"

describe("clinicSlugFor", () => {
  it("keeps an org slug that fits the clinic slug rule", () => {
    expect(clinicSlugFor("clinica-lumen", ORG_ID)).toBe("clinica-lumen")
  })

  it("falls back to an id slug when the org slug does not fit", () => {
    // Org slugs can reach 32 characters with a "-2" suffix.
    const long = "clinica-de-saude-da-mulher-lx-2"
    expect(long.length).toBeGreaterThan(30)
    expect(clinicSlugFor(long, ORG_ID)).toBe("clinic-3ecf81178b32")
    expect(clinicSlugFor("ab", ORG_ID)).toBe("clinic-3ecf81178b32")
    expect(clinicSlugFor("a--b-clinic", ORG_ID)).toBe("clinic-3ecf81178b32")
  })
})

describe("normalizeClinicTaxId", () => {
  it("strips spaces, dots and dashes and upper-cases", () => {
    expect(normalizeClinicTaxId("pt 515.001-708")).toBe("PT515001708")
    expect(normalizeClinicTaxId("515001708")).toBe("515001708")
  })

  it("rejects malformed numbers", () => {
    expect(() => normalizeClinicTaxId("PT-12")).toThrow(ClinicError)
    expect(() => normalizeClinicTaxId("PT51500170!")).toThrow(ClinicError)
  })
})
