import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({ auth: {}, db: vi.fn() }))

import {
  NEW_CREDENTIAL_PATHS,
  newCredentialVerdict,
  staffMustSignInAgain,
} from "./staff-fresh-session"

const NOW = new Date("2026-11-21T12:00:00.000Z")
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000)
const staff = { isStaff: vi.fn(async () => true) }
const notStaff = { isStaff: vi.fn(async () => false) }

describe("staffMustSignInAgain", () => {
  it.each([...NEW_CREDENTIAL_PATHS])(
    "refuses %s for staff on a session from yesterday",
    async (path) => {
      await expect(
        staffMustSignInAgain(
          { path, userId: "u1", sessionCreatedAt: hoursAgo(13), now: NOW },
          staff
        )
      ).resolves.toBe(true)
    }
  )

  it("lets staff through on a session from today", async () => {
    await expect(
      staffMustSignInAgain(
        {
          path: "/link-social",
          userId: "u1",
          sessionCreatedAt: hoursAgo(3).toISOString(),
          now: NOW,
        },
        staff
      )
    ).resolves.toBe(false)
  })

  it("never asks an expert or a member, however old the session", async () => {
    await expect(
      staffMustSignInAgain(
        {
          path: "/link-social",
          userId: "u1",
          sessionCreatedAt: hoursAgo(24 * 20),
          now: NOW,
        },
        notStaff
      )
    ).resolves.toBe(false)
  })

  it("treats a session with no readable start as old", async () => {
    for (const sessionCreatedAt of [null, undefined, "not a date"]) {
      await expect(
        staffMustSignInAgain(
          { path: "/api-key/create", userId: "u1", sessionCreatedAt, now: NOW },
          staff
        )
      ).resolves.toBe(true)
    }
  })

  it("leaves every other request alone without looking anyone up", async () => {
    const deps = { isStaff: vi.fn(async () => true) }
    await expect(
      staffMustSignInAgain(
        {
          path: "/organization/set-active",
          userId: "u1",
          sessionCreatedAt: hoursAgo(100),
          now: NOW,
        },
        deps
      )
    ).resolves.toBe(false)
    expect(deps.isStaff).not.toHaveBeenCalled()
  })
})

describe("newCredentialVerdict", () => {
  const session = (id: string, hours: number) => ({
    user: { id },
    session: { createdAt: hoursAgo(hours) },
  })
  const onlyStaff = { isStaff: async (id: string) => id === "staff" }
  const bearer = new Headers({ authorization: "Bearer a-session-token" })
  const none = new Headers()

  it("refuses when an old staff token rides behind a fresh cookie from another account", async () => {
    // A throwaway account's cookie in front of an old staff bearer token:
    // the endpoint acts for the bearer, so the guard must ask about it too.
    const fromHeaders = vi.fn(async () => session("staff", 48))
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: true,
          fromCookie: async () => session("throwaway", 0),
          headers: bearer,
          fromHeaders,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("sign-in-again")
    expect(fromHeaders).toHaveBeenCalledWith(bearer)
  })

  it("refuses an old staff cookie, and an old staff bearer token alone", async () => {
    await expect(
      newCredentialVerdict(
        {
          path: "/api-key/update",
          hasSessionCookie: true,
          fromCookie: async () => session("staff", 13),
          headers: none,
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("sign-in-again")
    await expect(
      newCredentialVerdict(
        {
          path: "/passkey/verify-registration",
          hasSessionCookie: false,
          fromCookie: async () => null,
          headers: bearer,
          fromHeaders: async () => session("staff", 13),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("sign-in-again")
  })

  it("lets staff through on a session from today, and never asks anyone else", async () => {
    const fromHeaders = vi.fn()
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: true,
          fromCookie: async () => session("staff", 2),
          headers: none,
          fromHeaders,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("allow")
    // No header, no read through it.
    expect(fromHeaders).not.toHaveBeenCalled()
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: true,
          fromCookie: async () => session("expert", 24 * 30),
          headers: none,
          fromHeaders,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("allow")
  })

  it("refuses a cookie or a bearer token the session store no longer knows", async () => {
    // Revoked a minute ago, but the browser still holds its 5-minute copy,
    // which the endpoint behind the hook might read.
    await expect(
      newCredentialVerdict(
        {
          path: "/organization/invite-member",
          hasSessionCookie: true,
          fromCookie: async () => null,
          headers: none,
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("no-session")
    // The same when a good session comes with a dead one beside it.
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: true,
          fromCookie: async () => null,
          headers: bearer,
          fromHeaders: async () => session("expert", 1),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("no-session")
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: true,
          fromCookie: async () => session("expert", 1),
          headers: bearer,
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("no-session")
  })

  it("leaves a request with no credentials to the endpoint", async () => {
    await expect(
      newCredentialVerdict(
        {
          path: "/link-social",
          hasSessionCookie: false,
          fromCookie: async () => null,
          headers: undefined,
          fromHeaders: vi.fn(),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("allow")
  })

  it("reads no session at all for a path that hands out nothing", async () => {
    const fromCookie = vi.fn()
    await expect(
      newCredentialVerdict(
        {
          path: "/get-session",
          hasSessionCookie: true,
          fromCookie,
          headers: bearer,
          fromHeaders: vi.fn(),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe("allow")
    expect(fromCookie).not.toHaveBeenCalled()
  })
})
