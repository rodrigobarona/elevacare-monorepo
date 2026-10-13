import { describe, expect, it } from "vitest"
import {
  callDisplayName,
  localCallDisplayName,
} from "./client/call-display-name"

describe("callDisplayName", () => {
  it("uses the Daily user_name when present", () => {
    expect(callDisplayName("Rodrigo Barona", "Member")).toBe("Rodrigo Barona")
    expect(callDisplayName("  Ana  ", "Expert")).toBe("Ana")
  })

  it("falls back when Daily has no name yet", () => {
    expect(callDisplayName("", "Member")).toBe("Member")
    expect(callDisplayName(undefined, "Expert")).toBe("Expert")
  })
})

describe("localCallDisplayName", () => {
  it("marks the local participant with their name", () => {
    expect(
      localCallDisplayName("Rodrigo", "You", (name) => `${name} (you)`)
    ).toBe("Rodrigo (you)")
    expect(localCallDisplayName("", "You", (name) => `${name} (you)`)).toBe(
      "You"
    )
  })
})
