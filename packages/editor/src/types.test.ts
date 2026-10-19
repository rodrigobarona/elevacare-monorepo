import { describe, expect, it } from "vitest"

import { plainTextToPlateValue, toPlainTextFromNodes } from "./types"

describe("plainTextToPlateValue", () => {
  it("makes one paragraph per non-empty line", () => {
    expect(plainTextToPlateValue("First line\n\nSecond line")).toEqual([
      { type: "p", children: [{ text: "First line" }] },
      { type: "p", children: [{ text: "Second line" }] },
    ])
  })

  it("returns a single empty paragraph for empty text", () => {
    expect(plainTextToPlateValue("")).toEqual([
      { type: "p", children: [{ text: "" }] },
    ])
  })

  it("round-trips through toPlainTextFromNodes", () => {
    const text = "I help runners.\nI work online."
    expect(toPlainTextFromNodes(plainTextToPlateValue(text))).toBe(text)
  })
})
