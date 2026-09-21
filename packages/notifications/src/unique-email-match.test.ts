import { describe, expect, it } from "vitest"
import { pickUniqueEmailMatch } from "./unique-email-match"

describe("pickUniqueEmailMatch", () => {
  it("returns null when no rows match", () => {
    expect(pickUniqueEmailMatch([], "ana@example.com")).toBeNull()
  })

  it("returns the only case-insensitive match", () => {
    expect(
      pickUniqueEmailMatch(
        [{ email: "Ana@example.com", userId: "1" }],
        "ana@example.com"
      )
    ).toEqual({ email: "Ana@example.com", userId: "1" })
  })

  it("prefers the exact-case row when two case variants exist", () => {
    expect(
      pickUniqueEmailMatch(
        [
          { email: "Ana@example.com", userId: "1" },
          { email: "ana@example.com", userId: "2" },
        ],
        "ana@example.com"
      )
    ).toEqual({ email: "ana@example.com", userId: "2" })
  })

  it("throws when case variants are ambiguous", () => {
    expect(() =>
      pickUniqueEmailMatch(
        [
          { email: "Ana@example.com", userId: "1" },
          { email: "ANA@example.com", userId: "2" },
        ],
        "ana@example.com"
      )
    ).toThrow(/AMBIGUOUS_USER_EMAIL/)
  })
})
