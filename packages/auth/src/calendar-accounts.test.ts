import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({ auth: {}, db: () => ({}), main: {} }))
vi.mock("@eleva/audit", () => ({ withAudit: vi.fn() }))

const { emailFromIdToken, withoutCalendarScopes } =
  await import("./calendar-accounts")

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

describe("withoutCalendarScopes", () => {
  it("keeps sign-in scopes and drops Google calendar ones", () => {
    expect(
      withoutCalendarScopes(
        "google",
        "openid,email,profile,https://www.googleapis.com/auth/calendar.calendarlist.readonly,https://www.googleapis.com/auth/calendar.events.owned"
      )
    ).toBe("openid,email,profile")
  })

  it("drops Microsoft calendar scopes in any case or separator", () => {
    expect(
      withoutCalendarScopes(
        "microsoft",
        "openid profile email User.Read Calendars.ReadWrite offline_access"
      )
    ).toBe("openid,profile,email,User.Read,offline_access")
  })

  it("returns null when nothing is left", () => {
    expect(
      withoutCalendarScopes(
        "google",
        "https://www.googleapis.com/auth/calendar.events.freebusy"
      )
    ).toBeNull()
    expect(withoutCalendarScopes("google", null)).toBeNull()
  })
})
