import { describe, expect, it } from "vitest"
import { displayLanguage, displayRegion } from "./display-names"

describe("display names", () => {
  it("localizes language codes", () => {
    expect(displayLanguage("fr", "en")).toBe("French")
    expect(displayLanguage("pt", "pt")).toBe("português")
    expect(displayLanguage("fr", "pt")).toBe("francês")
  })

  it("localizes region codes case-insensitively", () => {
    expect(displayRegion("es", "en")).toBe("Spain")
  })

  it("falls back to the code when it is not a valid tag", () => {
    expect(displayLanguage("not a code", "en")).toBe("not a code")
  })
})
