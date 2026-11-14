import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const DAY_MS = 24 * 60 * 60 * 1000

const file = readFileSync(
  new URL("../../public/.well-known/security.txt", import.meta.url),
  "utf8"
)

function field(name: string): string | undefined {
  return new RegExp(`^${name}: (.+)$`, "m").exec(file)?.[1]?.trim()
}

describe("/.well-known/security.txt (RFC 9116)", () => {
  it("names the contact, the policy and the canonical address", () => {
    expect(field("Contact")).toBe("mailto:security@eleva.care")
    expect(field("Policy")).toBe(
      "https://eleva.care/trust/vulnerability-disclosure"
    )
    expect(field("Canonical")).toBe(
      "https://eleva.care/.well-known/security.txt"
    )
  })

  // An expired file tells researchers the contact is stale. This fails 30
  // days ahead so the date is renewed before it passes; the RFC asks for
  // an expiry less than a year away.
  it("expires more than 30 days from now and within a year", () => {
    const expires = Date.parse(field("Expires") ?? "")
    expect(Number.isNaN(expires)).toBe(false)
    const daysLeft = (expires - Date.now()) / DAY_MS
    expect(daysLeft).toBeGreaterThan(30)
    expect(daysLeft).toBeLessThan(366)
  })
})
