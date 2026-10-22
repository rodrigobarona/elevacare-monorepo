import { describe, expect, it } from "vitest"
import { offerInvariantFieldForCode } from "./offer-invariant-fields"

describe("offerInvariantFieldForCode", () => {
  it("maps location and language codes to form fields", () => {
    expect(offerInvariantFieldForCode("IN_PERSON_LOCATION_REQUIRED")).toBe(
      "location"
    )
    expect(offerInvariantFieldForCode("EMPTY_LANGUAGE_LIST")).toBe("languages")
    expect(offerInvariantFieldForCode("CLINICAL_WORLDWIDE")).toBe("worldwide")
    expect(offerInvariantFieldForCode("SCOPE_OUTSIDE_SERVICE_COUNTRIES")).toBe(
      "countries"
    )
  })
})
