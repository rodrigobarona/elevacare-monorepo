import { describe, expect, it } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { persistLocaleCookie, shouldPersistLocaleCookie } from "./proxy-locale"

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
})
