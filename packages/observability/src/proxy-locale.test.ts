import { describe, expect, it } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { persistLocaleCookie } from "./proxy-locale"

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
})
