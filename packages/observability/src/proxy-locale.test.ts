import { describe, expect, it } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import {
  persistLocaleCookie,
  resolveLocaleForRequest,
  shareIntlLocaleCookie,
  shouldPersistLocaleCookie,
} from "./proxy-locale"

function requestWithCookie(host: string, cookie?: string): NextRequest {
  const headers = new Headers({ host })
  if (cookie) headers.set("cookie", cookie)
  return new NextRequest("http://localhost:3000/es", { headers })
}

describe("persistLocaleCookie", () => {
  it("skips Set-Cookie on localhost when the value already matches", () => {
    const req = requestWithCookie("localhost:3000", "ELEVA_LOCALE=es")
    const res = NextResponse.next()
    persistLocaleCookie(req, res, "es")
    expect(res.headers.getSetCookie?.() ?? []).toHaveLength(0)
  })

  it("upgrades a matching cookie to Domain=.eleva.care on Eleva hosts", () => {
    const req = requestWithCookie("dev.eleva.care", "ELEVA_LOCALE=es")
    const res = NextResponse.next()
    persistLocaleCookie(req, res, "es")
    const setCookie = res.headers.getSetCookie?.() ?? []
    const localeCookie = setCookie.find((c) => c.startsWith("ELEVA_LOCALE="))
    expect(localeCookie).toMatch(/^ELEVA_LOCALE=es\b/)
    expect(localeCookie).toMatch(/Domain=\.eleva\.care/i)
  })

  it("writes when the locale changes", () => {
    const req = requestWithCookie("dev.eleva.care", "ELEVA_LOCALE=en")
    const res = NextResponse.next()
    persistLocaleCookie(req, res, "es")
    const localeCookie = (res.headers.getSetCookie?.() ?? []).find((c) =>
      c.startsWith("ELEVA_LOCALE=")
    )
    expect(localeCookie).toMatch(/^ELEVA_LOCALE=es\b/)
  })

  it("never writes on a Server Action POST, so a just-saved locale wins", () => {
    // The settings language action sets ELEVA_LOCALE=en on this response;
    // the proxy must not append the stale es the browser sent.
    const req = new NextRequest("https://dev.eleva.care/account/settings", {
      method: "POST",
      headers: {
        host: "dev.eleva.care",
        cookie: "ELEVA_LOCALE=es",
        "next-action": "abc123",
        "sec-fetch-dest": "empty",
      },
    })
    const res = NextResponse.next()
    persistLocaleCookie(req, res, "es")
    expect(res.headers.getSetCookie?.() ?? []).toHaveLength(0)
  })

  it("skips RSC refreshes and prefetches", () => {
    const cases: Record<string, string>[] = [
      { rsc: "1" },
      { "next-router-prefetch": "1" },
      { "sec-fetch-dest": "empty" },
    ]
    for (const extra of cases) {
      const req = new NextRequest("https://dev.eleva.care/account/settings", {
        headers: {
          host: "dev.eleva.care",
          cookie: "ELEVA_LOCALE=es",
          ...extra,
        },
      })
      expect(shouldPersistLocaleCookie(req)).toBe(false)
    }
  })

  it("writes on a document navigation", () => {
    const req = new NextRequest("https://dev.eleva.care/account/settings", {
      headers: {
        host: "dev.eleva.care",
        cookie: "ELEVA_LOCALE=es",
        "sec-fetch-dest": "document",
      },
    })
    expect(shouldPersistLocaleCookie(req)).toBe(true)
  })

  it("expires a host-only duplicate and leaves the shared cookie untouched", () => {
    // The browser holds an old host-only es and the shared en it just saved;
    // the header cannot say which is which, so only the expiry is sent.
    const req = new NextRequest("https://dev.eleva.care/space", {
      headers: {
        host: "dev.eleva.care",
        cookie: "ELEVA_LOCALE=en; ELEVA_LOCALE=es",
        "sec-fetch-dest": "document",
      },
    })
    const res = NextResponse.next()
    // Other cookies set first, as the auth proxy does, must not drop the expiry.
    res.cookies.set("eleva_last_workspace", "space")
    persistLocaleCookie(req, res, resolveLocaleForRequest(req))
    const setCookie = res.headers.getSetCookie?.() ?? []
    const locale = setCookie.filter((c) => c.startsWith("ELEVA_LOCALE="))
    expect(locale).toHaveLength(1)
    expect(locale[0]).toMatch(/^ELEVA_LOCALE=;.*Max-Age=0/)
    expect(locale[0]).not.toMatch(/Domain=/i)
    expect(setCookie.some((c) => c.startsWith("eleva_last_workspace="))).toBe(
      true
    )
  })

  it("does not expire anything when only one cookie was sent", () => {
    const req = new NextRequest("https://dev.eleva.care/space", {
      headers: {
        host: "dev.eleva.care",
        cookie: "ELEVA_LOCALE=en",
        "sec-fetch-dest": "document",
      },
    })
    const res = NextResponse.next()
    persistLocaleCookie(req, res, "en")
    const locale = (res.headers.getSetCookie?.() ?? []).filter((c) =>
      c.startsWith("ELEVA_LOCALE=")
    )
    expect(locale).toHaveLength(1)
  })
})

describe("shareIntlLocaleCookie", () => {
  it("re-issues next-intl's host-only cookie on the shared domain, even on RSC", () => {
    const req = new NextRequest("https://dev.eleva.care/es", {
      headers: { host: "dev.eleva.care", rsc: "1" },
    })
    const res = NextResponse.next()
    res.cookies.set("ELEVA_LOCALE", "es", { path: "/", sameSite: "lax" })
    shareIntlLocaleCookie(req, res)
    const locale = (res.headers.getSetCookie?.() ?? []).filter((c) =>
      c.startsWith("ELEVA_LOCALE=")
    )
    expect(locale).toHaveLength(1)
    expect(locale[0]).toMatch(/^ELEVA_LOCALE=es;.*Domain=\.eleva\.care/i)
  })

  it("leaves localhost host-only", () => {
    const req = new NextRequest("http://localhost:3000/es", {
      headers: { host: "localhost:3000" },
    })
    const res = NextResponse.next()
    res.cookies.set("ELEVA_LOCALE", "es", { path: "/" })
    shareIntlLocaleCookie(req, res)
    expect(res.headers.getSetCookie?.()[0]).not.toMatch(/Domain=/i)
  })
})
