import { describe, expect, it } from "vitest"
import { locales } from "./i18n-locales"
import { EU_EMERGENCY_NUMBER, urgentHelpNumbers } from "./urgent-help"

describe("urgentHelpNumbers", () => {
  it("sends every locale to 112", () => {
    for (const locale of locales) {
      expect(urgentHelpNumbers(locale).emergency).toEqual({
        display: "112",
        href: "tel:112",
      })
    }
    expect(EU_EMERGENCY_NUMBER.display).toBe("112")
  })

  it("names SNS 24 in Portuguese copy", () => {
    expect(urgentHelpNumbers("pt").national).toEqual({
      display: "808 24 24 24",
      href: "tel:808242424",
    })
    expect(urgentHelpNumbers("pt-PT").national?.display).toBe("808 24 24 24")
  })

  it("names 024 in Spanish copy", () => {
    expect(urgentHelpNumbers("es").national).toEqual({
      display: "024",
      href: "tel:024",
    })
  })

  it("names no national line in English, read across the EU", () => {
    expect(urgentHelpNumbers("en").national).toBeNull()
    expect(urgentHelpNumbers("en-GB").national).toBeNull()
  })

  it("only ever links to a phone number", () => {
    for (const locale of locales) {
      const { emergency, national } = urgentHelpNumbers(locale)
      for (const number of [emergency, national]) {
        if (number) expect(number.href).toMatch(/^tel:\d+$/)
      }
    }
  })
})
