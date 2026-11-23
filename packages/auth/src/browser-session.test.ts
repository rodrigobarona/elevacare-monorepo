import { describe, expect, it } from "vitest"
import {
  browserSessionFrom,
  sameReviewer,
  signInLinkWasUsed,
  type BrowserSession,
} from "./browser-session"

const session = (over: Partial<BrowserSession> = {}): BrowserSession => ({
  userId: "staff-1",
  email: "ana@eleva.care",
  activeOrganizationId: "staff-org",
  startedAt: new Date("2026-11-23T08:00:00.000Z"),
  ...over,
})

describe("browserSessionFrom", () => {
  it("is signed out only when the server said so", () => {
    expect(browserSessionFrom({ data: null, error: null })).toBeNull()
  })

  it.each([
    ["an error", { data: null, error: { status: 500 } }],
    ["no data at all", {}],
    ["a body that is not a session", { data: {} }],
    ["a page of something else", { data: { html: "<html>" } }],
    ["a session with no user", { data: { session: { id: "s" } } }],
    ["a user with no session", { data: { user: { id: "u", email: "a@b" } } }],
    [
      "a user that cannot be read",
      { data: { session: {}, user: { id: 7, email: "a@b" } } },
    ],
  ])(
    "cannot tell from %s, and does not call it signed out",
    (_what, answer) => {
      expect(browserSessionFrom(answer)).toBeUndefined()
    }
  )

  it("reads who, where and since when", () => {
    expect(
      browserSessionFrom({
        data: {
          session: {
            createdAt: "2026-11-23T08:00:00.000Z",
            activeOrganizationId: "staff-org",
          },
          user: { id: "staff-1", email: "ana@eleva.care" },
        },
      })
    ).toEqual(session())
    expect(
      browserSessionFrom({
        data: {
          session: { createdAt: "not a date" },
          user: { id: "staff-1", email: "ana@eleva.care" },
        },
      })
    ).toEqual(session({ activeOrganizationId: null, startedAt: null }))
  })
})

describe("signInLinkWasUsed", () => {
  const sent = Date.parse("2026-11-23T09:00:00.000Z")
  const before = Date.parse("2026-11-23T08:00:00.000Z")
  const after = new Date("2026-11-23T09:01:00.000Z")
  const used = (
    now: BrowserSession | null | undefined,
    was: number | null | undefined
  ) =>
    signInLinkWasUsed({
      now,
      email: " Ana@Eleva.care ",
      before: was,
      linkSentAt: sent,
    })

  it("says no while nobody, or someone else, is signed in", () => {
    expect(used(null, null)).toBe(false)
    expect(used(undefined, null)).toBe(false)
    expect(
      used(session({ email: "rui@eleva.care", startedAt: after }), null)
    ).toBe(false)
  })

  it("says yes for a sign-in of that person that was not there before", () => {
    expect(used(session({ startedAt: after }), null)).toBe(true)
    expect(used(session({ startedAt: after }), before)).toBe(true)
  })

  it("says no for the sign-in the browser already carried", () => {
    expect(used(session(), before)).toBe(false)
  })

  it("goes by the link's own time when the sign-in before could not be read", () => {
    // Signed in all along: not sent on.
    expect(used(session(), undefined)).toBe(false)
    // Signed in since the link was sent: the link was used.
    expect(used(session({ startedAt: after }), undefined)).toBe(true)
    expect(used(session({ startedAt: null }), undefined)).toBe(false)
  })
})

describe("sameReviewer", () => {
  const reviewer = { id: "staff-1", orgId: "staff-org" }

  it("keeps the page for the same person in the same workspace", () => {
    expect(sameReviewer(session(), reviewer)).toBe(true)
  })

  it("keeps the page when it could not tell", () => {
    expect(sameReviewer(undefined, reviewer)).toBe(true)
  })

  it.each([
    ["signed out", null],
    ["someone else", session({ userId: "staff-2" })],
    [
      "the same person in another workspace",
      session({ activeOrganizationId: "clinic-1" }),
    ],
    [
      "the same person with no workspace chosen",
      session({ activeOrganizationId: null }),
    ],
  ])("does not keep it for %s", (_who, now) => {
    expect(sameReviewer(now, reviewer)).toBe(false)
  })
})
