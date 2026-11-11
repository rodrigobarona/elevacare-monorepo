import { describe, expect, it } from "vitest"
import { guestSignupPath } from "./guest-signup"

describe("guestSignupPath", () => {
  it("claims the account the booking started", () => {
    const url = new URL(
      guestSignupPath({ email: "ada@example.com", name: "Ada Lovelace" }),
      "https://eleva.care"
    )
    expect(url.pathname).toBe("/signup")
    expect(url.searchParams.get("claim")).toBe("1")
    expect(url.searchParams.get("email")).toBe("ada@example.com")
    expect(url.searchParams.get("name")).toBe("Ada Lovelace")
  })

  it("carries the email and name only", () => {
    const url = new URL(
      guestSignupPath({ email: "ada@example.com", name: "Ada" }),
      "https://eleva.care"
    )
    expect([...url.searchParams.keys()].sort()).toEqual([
      "claim",
      "email",
      "name",
    ])
  })

  it("leaves an empty name out", () => {
    expect(guestSignupPath({ email: "ada@example.com", name: "  " })).toBe(
      "/signup?claim=1&email=ada%40example.com"
    )
    expect(guestSignupPath({ email: "ada@example.com" })).toBe(
      "/signup?claim=1&email=ada%40example.com"
    )
  })

  it("encodes values so they cannot add parameters", () => {
    const url = new URL(
      guestSignupPath({ email: "a&phone=1@example.com", name: "x&claim=0" }),
      "https://eleva.care"
    )
    expect(url.searchParams.get("phone")).toBeNull()
    expect(url.searchParams.getAll("claim")).toEqual(["1"])
  })
})
