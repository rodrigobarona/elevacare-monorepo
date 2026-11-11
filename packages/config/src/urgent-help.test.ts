import { describe, expect, it } from "vitest"
import {
  URGENT_HELP_LINES,
  URGENT_HELP_NUMBERS,
  isUrgentHelpLine,
} from "./urgent-help"

describe("URGENT_HELP_NUMBERS", () => {
  it("sends emergencies to 112", () => {
    expect(URGENT_HELP_NUMBERS.emergency).toEqual({
      display: "112",
      href: "tel:112",
    })
  })

  it("carries the national lines the copy names", () => {
    expect(URGENT_HELP_NUMBERS.sns24.display).toBe("808 24 24 24")
    expect(URGENT_HELP_NUMBERS.prevention1411.display).toBe("1411")
    expect(URGENT_HELP_NUMBERS.linea024.display).toBe("024")
  })

  it("only ever links to the phone number it shows", () => {
    for (const line of URGENT_HELP_LINES) {
      const { display, href } = URGENT_HELP_NUMBERS[line]
      expect(href).toBe(`tel:${display.replaceAll(" ", "")}`)
      expect(href).toMatch(/^tel:\d+$/)
    }
  })

  it("recognises its own keys only", () => {
    expect(isUrgentHelpLine("emergency")).toBe(true)
    expect(isUrgentHelpLine("linea024")).toBe(true)
    expect(isUrgentHelpLine("toString")).toBe(false)
    expect(isUrgentHelpLine("javascript")).toBe(false)
  })
})
