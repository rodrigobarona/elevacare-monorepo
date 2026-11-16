import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({ auth: {}, db: () => ({}), main: {} }))
vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))

const { emailFromIdToken } = await import("./calendar-accounts")

function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`
}

describe("emailFromIdToken", () => {
  it("reads the sign-in email", () => {
    expect(emailFromIdToken(token({ email: "member@example.com" }))).toBe(
      "member@example.com"
    )
  })

  it("falls back to preferred_username when it is an address", () => {
    expect(
      emailFromIdToken(token({ preferred_username: "ana@clinic.pt" }))
    ).toBe("ana@clinic.pt")
    expect(emailFromIdToken(token({ preferred_username: "ana" }))).toBeNull()
  })

  it("returns null for a missing or malformed token", () => {
    expect(emailFromIdToken(null)).toBeNull()
    expect(emailFromIdToken("not-a-jwt")).toBeNull()
    expect(emailFromIdToken("a.%%%.c")).toBeNull()
  })
})
