import { describe, expect, it } from "vitest"
import { CLOSURE_RECENT_SIGN_IN_MS, isRecentSignIn } from "./practice-closure"

describe("isRecentSignIn (closure step-up)", () => {
  const now = new Date("2026-11-16T15:00:00Z")
  const ago = (ms: number) => new Date(now.getTime() - ms)

  it("accepts a sign-in within 15 minutes", () => {
    expect(isRecentSignIn(ago(0), now)).toBe(true)
    expect(isRecentSignIn(ago(CLOSURE_RECENT_SIGN_IN_MS), now)).toBe(true)
  })

  it("refuses an older sign-in", () => {
    expect(isRecentSignIn(ago(CLOSURE_RECENT_SIGN_IN_MS + 1), now)).toBe(false)
  })

  it("refuses credentials with no sign-in moment and clock skew", () => {
    expect(isRecentSignIn(null, now)).toBe(false)
    expect(isRecentSignIn(new Date(now.getTime() + 60_000), now)).toBe(false)
  })
})
