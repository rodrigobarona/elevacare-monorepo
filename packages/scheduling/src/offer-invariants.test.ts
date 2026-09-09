import { describe, expect, it } from "vitest"
import { assertOfferInvariants } from "./offer-invariants"

const base = {
  kind: "non_clinical" as const,
  worldwideRemote: true,
  serviceCountries: ["PT", "ES"],
  profileLanguages: ["pt", "en", "es"],
  mode: "online" as const,
  countryScopeType: "list" as const,
  countryScopeCodes: ["PT", "ES"],
  languages: ["pt", "en"],
}

describe("assertOfferInvariants", () => {
  it("accepts a scoped non-clinical online offer", () => {
    expect(assertOfferInvariants(base)).toBeNull()
  })

  it("rejects clinical + worldwide", () => {
    expect(
      assertOfferInvariants({
        ...base,
        kind: "clinical",
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBe("CLINICAL_WORLDWIDE")
  })

  it("rejects an explicit scope outside service_countries", () => {
    expect(
      assertOfferInvariants({
        ...base,
        countryScopeCodes: ["PT", "BR"],
      })
    ).toBe("SCOPE_OUTSIDE_SERVICE_COUNTRIES")
  })

  it("rejects an explicit empty country list", () => {
    expect(
      assertOfferInvariants({
        ...base,
        countryScopeCodes: [],
      })
    ).toBe("EMPTY_COUNTRY_LIST")
  })

  it("rejects in_person whose scope is not the location country", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "in_person",
        countryScopeCodes: ["PT"],
        locationCountry: "ES",
      })
    ).toBe("IN_PERSON_COUNTRY_MISMATCH")
  })

  it("rejects non-clinical worldwide without worldwide_remote", () => {
    expect(
      assertOfferInvariants({
        ...base,
        worldwideRemote: false,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBe("WORLDWIDE_REQUIRES_REMOTE")
  })

  it("rejects languages that are not on the profile", () => {
    expect(
      assertOfferInvariants({
        ...base,
        languages: ["pt", "de"],
      })
    ).toBe("LANGUAGE_NOT_ON_PROFILE")
  })

  it("rejects worldwide scope with an explicit country list", () => {
    expect(
      assertOfferInvariants({
        ...base,
        countryScopeType: "worldwide",
        countryScopeCodes: ["PT"],
      })
    ).toBe("WORLDWIDE_WITH_COUNTRY_LIST")
  })

  it("rejects an empty language list", () => {
    expect(assertOfferInvariants({ ...base, languages: [] })).toBe(
      "EMPTY_LANGUAGE_LIST"
    )
  })

  it("accepts non-clinical worldwide when worldwideRemote is set", () => {
    expect(
      assertOfferInvariants({
        ...base,
        worldwideRemote: true,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBeNull()
  })

  it("rejects in_person with a worldwide scope", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "in_person",
        countryScopeType: "worldwide",
        countryScopeCodes: [],
        locationCountry: "PT",
      })
    ).toBe("IN_PERSON_COUNTRY_MISMATCH")
  })

  it("rejects in_person without a location country", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "in_person",
        countryScopeCodes: ["PT"],
      })
    ).toBe("IN_PERSON_LOCATION_REQUIRED")
  })

  it("accepts phone with an explicit country list", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "phone",
        countryScopeCodes: ["PT", "ES"],
      })
    ).toBeNull()
  })

  it("applies online worldwide rules to phone, not in_person rules", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "phone",
        worldwideRemote: false,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBe("WORLDWIDE_REQUIRES_REMOTE")
    expect(
      assertOfferInvariants({
        ...base,
        mode: "phone",
        worldwideRemote: true,
        countryScopeType: "worldwide",
        countryScopeCodes: [],
      })
    ).toBeNull()
  })

  it("rejects in_person when the location is outside service_countries", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "in_person",
        countryScopeCodes: ["ES"],
        locationCountry: "ES",
        serviceCountries: ["PT"],
      })
    ).toBe("SCOPE_OUTSIDE_SERVICE_COUNTRIES")
  })

  it("accepts in_person when the explicit scope is the location country", () => {
    expect(
      assertOfferInvariants({
        ...base,
        mode: "in_person",
        countryScopeCodes: ["PT"],
        locationCountry: "PT",
      })
    ).toBeNull()
  })

  it("normalizes country and language casing", () => {
    expect(
      assertOfferInvariants({
        ...base,
        serviceCountries: [" pt "],
        countryScopeCodes: ["PT"],
        profileLanguages: [" PT "],
        languages: ["pt"],
      })
    ).toBeNull()
  })
})
