import { describe, expect, it } from "vitest"
import { hreflangLanguages, localePath } from "./hreflang"

describe("localePath", () => {
  it("prefixes pt and es and leaves en unprefixed", () => {
    expect(localePath("en", "/experts")).toBe("/experts")
    expect(localePath("pt", "/experts")).toBe("/pt/experts")
    expect(localePath("es", "/about")).toBe("/es/about")
  })
})

describe("hreflangLanguages", () => {
  it("includes pt, en, es, and x-default", () => {
    expect(hreflangLanguages("/experts")).toMatchObject({
      en: "/experts",
      pt: "/pt/experts",
      es: "/es/experts",
      "x-default": "/experts",
    })
  })
})
