import { describe, expect, it } from "vitest"
import { isE164, maskPhone, toE164 } from "./e164"

describe("toE164", () => {
  it("keeps a valid international number", () => {
    expect(toE164("+351912345678", "PT")).toBe("+351912345678")
  })

  it("adds the country calling code to a national number", () => {
    expect(toE164("912 345 678", "PT")).toBe("+351912345678")
  })

  it("does not double the calling code", () => {
    expect(toE164("351912345678", "PT")).toBe("+351912345678")
  })

  it("parses a 00-prefixed Portuguese number", () => {
    expect(toE164("00351912345678", "PT")).toBe("+351912345678")
  })

  it("keeps a Brazilian national number whose area code is 55", () => {
    expect(toE164("55987654321", "BR")).toBe("+5555987654321")
  })

  it("strips the French trunk prefix instead of treating 0 as a digit", () => {
    expect(toE164("0612345678", "FR")).toBe("+33612345678")
  })

  it("rejects a too-short number", () => {
    expect(toE164("12", "PT")).toBeNull()
  })
})

describe("maskPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+351912345678")).toBe("+351 ··· 678")
  })
})

describe("isE164", () => {
  it("accepts formatted E.164", () => {
    expect(isE164("+351 912 345 678")).toBe(true)
  })
})
