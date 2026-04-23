import { describe, expect, it } from "vitest"
import { redactPayload, redactString, shouldRedactKey } from "./redaction"

describe("shouldRedactKey", () => {
  it("catches exact matches (case-insensitive, normalising separators)", () => {
    expect(shouldRedactKey("password")).toBe(true)
    expect(shouldRedactKey("PASSWORD")).toBe(true)
    expect(shouldRedactKey("session_notes")).toBe(true)
    expect(shouldRedactKey("session.notes")).toBe(true)
    expect(shouldRedactKey("sessionNotes")).toBe(true)
    expect(shouldRedactKey("transcript_text")).toBe(true)
    expect(shouldRedactKey("access_token")).toBe(true)
    expect(shouldRedactKey("NIF")).toBe(true)
  })

  it("leaves benign keys untouched", () => {
    expect(shouldRedactKey("email")).toBe(false)
    expect(shouldRedactKey("display_name")).toBe(false)
    expect(shouldRedactKey("org_id")).toBe(false)
  })
})

describe("redactString", () => {
  it("scrubs credit-card-shaped numbers", () => {
    expect(redactString("card 4111 1111 1111 1111")).toBe("[redacted]")
    expect(redactString("pan:4111-1111-1111-1111")).toBe("[redacted]")
  })

  it("scrubs stripe secret + publishable keys", () => {
    // Runtime-concatenated so the source does not trip GitHub push-
    // protection on a literal Stripe-key shape.
    const secretLike = ["sk", "live", "1234567890abcdef12345678"].join("_")
    const publishableLike = ["pk", "test", "1234567890abcdef12345678"].join("_")
    expect(redactString(secretLike)).toBe("[redacted]")
    expect(redactString(publishableLike)).toBe("[redacted]")
  })

  it("scrubs JWTs", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    expect(redactString(jwt)).toBe("[redacted]")
  })

  it("leaves benign strings untouched", () => {
    expect(redactString("hello world")).toBe("hello world")
    expect(redactString("user@example.test")).toBe("user@example.test")
  })
})

describe("redactPayload", () => {
  it("does not mutate the input", () => {
    const input = { nested: { password: "secret", email: "a@b.c" } }
    const out = redactPayload(input)
    expect(input.nested.password).toBe("secret")
    expect((out as typeof input).nested.password).toBe("[redacted]")
  })

  it("deep-redacts sensitive keys", () => {
    const out = redactPayload({
      user: { email: "a@b.c", password: "hunter2", nif: "123456789" },
      booking: {
        amount: 3000,
        card_number: "4111111111111111",
      },
    })
    expect(out).toEqual({
      user: { email: "a@b.c", password: "[redacted]", nif: "[redacted]" },
      booking: { amount: 3000, card_number: "[redacted]" },
    })
  })

  it("scrubs array elements", () => {
    const out = redactPayload({
      logs: [{ password: "x" }, "sk_test_abcdefghijklmnopqr"],
    })
    expect(out).toEqual({ logs: [{ password: "[redacted]" }, "[redacted]"] })
  })

  it("handles circular references", () => {
    type Node = { name: string; self?: Node; session_notes?: string }
    const a: Node = { name: "root", session_notes: "private" }
    a.self = a
    expect(() => redactPayload(a)).not.toThrow()
  })
})
