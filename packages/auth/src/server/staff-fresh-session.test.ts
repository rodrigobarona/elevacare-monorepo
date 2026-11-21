import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({ auth: {}, db: vi.fn() }))

import {
  mustRefuseForStaleStaffSession,
  NEW_CREDENTIAL_PATHS,
  sessionsForRequestHook,
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

describe("sessionsForRequestHook", () => {
  const staff = { user: { id: "staff" } }
  const throwaway = { user: { id: "throwaway" } }

  it("answers both sessions when a request carries a cookie and a bearer token", async () => {
    // A throwaway account's cookie in front of an old staff bearer token:
    // the endpoint acts for the bearer, so the guard must see it too.
    const headers = new Headers({ authorization: "Bearer old-staff-session" })
    await expect(
      sessionsForRequestHook({
        fromCookie: async () => throwaway,
        headers,
        fromHeaders: async () => staff,
      })
    ).resolves.toEqual([staff, throwaway])
  })

  it("finds a session sent as a bearer token alone", async () => {
    const headers = new Headers({ authorization: "Bearer old-staff-session" })
    const fromHeaders = vi.fn(async () => staff)
    await expect(
      sessionsForRequestHook({
        fromCookie: async () => null,
        headers,
        fromHeaders,
      })
    ).resolves.toEqual([staff])
    expect(fromHeaders).toHaveBeenCalledWith(headers)
  })

  it("answers the cookie session when there is no header", async () => {
    const fromHeaders = vi.fn()
    await expect(
      sessionsForRequestHook({
        fromCookie: async () => staff,
        headers: new Headers(),
        fromHeaders,
      })
    ).resolves.toEqual([staff])
    expect(fromHeaders).not.toHaveBeenCalled()
  })

  it("answers nobody when the request carries no credentials", async () => {
    await expect(
      sessionsForRequestHook({
        fromCookie: async () => null,
        headers: undefined,
        fromHeaders: vi.fn(),
      })
    ).resolves.toEqual([])
  })
})

describe("mustRefuseForStaleStaffSession", () => {
  const session = (id: string, hours: number) => ({
    user: { id },
    session: { createdAt: hoursAgo(hours) },
  })
  const onlyStaff = { isStaff: async (id: string) => id === "staff" }
  const bearer = new Headers({ authorization: "Bearer old-staff-session" })

  it("refuses when an old staff token rides behind a fresh cookie from another account", async () => {
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/link-social",
          fromCookie: async () => session("throwaway", 0),
          headers: bearer,
          fromHeaders: async () => session("staff", 48),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(true)
  })

  it("refuses an old staff cookie, and an old staff bearer token alone", async () => {
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/api-key/create",
          fromCookie: async () => session("staff", 13),
          headers: new Headers(),
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(true)
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/passkey/verify-registration",
          fromCookie: async () => null,
          headers: bearer,
          fromHeaders: async () => session("staff", 13),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(true)
  })

  it("lets staff through on a session from today, and never asks anyone else", async () => {
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/link-social",
          fromCookie: async () => session("staff", 2),
          headers: new Headers(),
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(false)
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/link-social",
          fromCookie: async () => session("expert", 24 * 30),
          headers: new Headers(),
          fromHeaders: async () => null,
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(false)
  })

  it("reads no session at all for a path that hands out nothing", async () => {
    const fromCookie = vi.fn()
    await expect(
      mustRefuseForStaleStaffSession(
        {
          path: "/get-session",
          fromCookie,
          headers: bearer,
          fromHeaders: vi.fn(),
          now: NOW,
        },
        onlyStaff
      )
    ).resolves.toBe(false)
    expect(fromCookie).not.toHaveBeenCalled()
  })
})
