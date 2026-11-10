import { describe, expect, it } from "vitest"
import { apexAllowed, apexServesV3, isApexHost } from "./apex"

describe("apex trust", () => {
  it("does not trust the apex while it serves the previous app", () => {
    expect(apexServesV3({})).toBe(false)
    expect(apexAllowed("https://eleva.care", {})).toBe(false)
    expect(apexAllowed("https://www.eleva.care", {})).toBe(false)
  })

  it("trusts the apex once the cutover flag is set", () => {
    const env = { ELEVA_APEX_IS_V3: "true" }
    expect(apexAllowed("https://eleva.care", env)).toBe(true)
  })

  it("leaves other hosts alone", () => {
    expect(apexAllowed("https://dev.eleva.care", {})).toBe(true)
    expect(isApexHost("api.eleva.care")).toBe(false)
    expect(apexAllowed("not a url", {})).toBe(false)
  })
})
