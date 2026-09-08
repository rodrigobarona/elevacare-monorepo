import { describe, expect, it } from "vitest"
import { isAlreadySignedOut } from "./already-signed-out"

describe("isAlreadySignedOut", () => {
  it("accepts a 401 API error", () => {
    expect(isAlreadySignedOut({ status: 401 })).toBe(true)
  })

  it("rejects other failures", () => {
    expect(isAlreadySignedOut({ status: 500, message: "db down" })).toBe(false)
    expect(isAlreadySignedOut(new Error("network"))).toBe(false)
  })
})
