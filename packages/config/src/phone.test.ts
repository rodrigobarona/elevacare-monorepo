import { describe, expect, it } from "vitest"
import { maskPhone } from "./phone"

describe("maskPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+351912345678")).toBe("+351 ··· 678")
  })

  it("strips formatting before masking", () => {
    expect(maskPhone("+351 912 345 678")).toBe("+351 ··· 678")
  })
})
