import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import type { GatewayOrigins } from "@eleva/config/dispatch"
import { createGatewayProxy } from "./lib/create-gateway-proxy"

const testOrigins: GatewayOrigins = {
  app: "http://localhost:3001",
  expert: "http://localhost:3003",
  team: "http://localhost:3004",
  academy: "http://localhost:3005",
  account: "http://localhost:3006",
  docs: "http://localhost:3008",
}

function makeRequest(
  pathname: string,
  init?: {
    headers?: Record<string, string>
    cookieNames?: string[]
    cookieValues?: Record<string, string>
    search?: string
  }
): NextRequest {
  const url = new URL(pathname + (init?.search ?? ""), "http://localhost:3000")
  const req = new NextRequest(url, { headers: init?.headers })

  if (init?.cookieNames || init?.cookieValues) {
    const values = init.cookieValues ?? {}
    const names = init.cookieNames ?? Object.keys(values)

    vi.spyOn(req.cookies, "has").mockImplementation((name) =>
      names.includes(String(name))
    )
    vi.spyOn(req.cookies, "get").mockImplementation((name) => {
      const key = String(name)
      const value = values[key] ?? (names.includes(key) ? "1" : undefined)
      return value !== undefined ? { name: key, value } : undefined
    })
  }

  return req
}

function marketingIntl() {
  return NextResponse.json({ zone: "marketing" }, { status: 200 })
}

describe("createGatewayProxy integration", () => {
  const originalAdminUrl = process.env.ADMIN_URL

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.ADMIN_URL = "http://localhost:3007"
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalAdminUrl === undefined) {
      delete process.env.ADMIN_URL
    } else {
      process.env.ADMIN_URL = originalAdminUrl
    }
  })

  it("301s retired /pt-BR paths to /pt and preserves the query (D-01)", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/pt-BR/experts", { search: "?sort=price" })
    )
    expect(intl).not.toHaveBeenCalled()
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/pt/experts?sort=price"
    )
  })

  it("301s bare /pt-BR to /pt before zone dispatch", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(makeRequest("/pt-BR"))
    expect(intl).not.toHaveBeenCalled()
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe("http://localhost:3000/pt")
  })

  it("301s /for-organizations to /for-clinics and preserves the query", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/pt/for-organizations", { search: "?ref=mvp" })
    )
    expect(intl).not.toHaveBeenCalled()
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/pt/for-clinics?ref=mvp"
    )
  })

  it("does not 301 nested /for-organizations paths", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(makeRequest("/pt/for-organizations/team-a"))
    expect(res.status).not.toBe(301)
  })

  it("301s retired quiz and help URLs to their D-10 targets", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })

    const quiz = await proxy(makeRequest("/pt/quiz", { search: "?src=legacy" }))
    expect(intl).not.toHaveBeenCalled()
    expect(quiz.status).toBe(301)
    expect(quiz.headers.get("location")).toBe(
      "http://localhost:3000/pt/experts?src=legacy"
    )

    const help = await proxy(makeRequest("/help/patient/booking"))
    expect(help.status).toBe(301)
    expect(help.headers.get("location")).toBe(
      "http://localhost:3000/docs/members/booking"
    )
  })

  it("sends the MVP's signed-in addresses to their new place, without the query", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    for (const [from, to] of [
      ["/appointments/patients/8f1c2d", "/dashboard"],
      ["/booking/schedule/limits", "/dashboard"],
      ["/setup", "/dashboard"],
      ["/register", "/signup"],
      ["/unauthorized", "/dashboard"],
      ["/sign-in", "/dashboard"],
      ["/sign-out", "/logout"],
      ["/events/evt_1", "/dashboard"],
      ["/settings/integrations", "/dashboard"],
      ["/payment/voucher/123", "/dashboard"],
      ["/profile/complete", "/dashboard"],
      ["/unsubscribe", "/account/notifications"],
      ["/dashboard/subscription", "/dashboard"],
      ["/account/identity/callback", "/dashboard"],
      ["/account/security/password", "/account/security"],
      ["/account/billing/receipts/pi_3Q", "/account/billing"],
      ["/account/profile", "/account/settings"],
    ] as const) {
      const res = await proxy(
        makeRequest(from, { search: "?redirect=%2Fx&token=abc&console=%2Fy" })
      )
      // Not a permanent answer: a browser must not keep it.
      expect(res.status, from).toBe(302)
      // Nothing of the old query goes along, whatever it carried.
      expect(res.headers.get("location"), from).toBe(
        `http://localhost:3000${to}`
      )
    }
  })

  it("sends the MVP's \"become an expert\" button to v3's, and still drops the query", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/register", {
        search: "?expert=true&plan=community-paygo",
      })
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/account/workspaces/create/expert"
    )
  })

  it("does not move the addresses v3 serves under the same words", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    for (const path of [
      "/dashboard",
      "/dashboard/",
      "/account/billing",
      "/account/billing/return",
      "/account/security",
      "/account/settings",
      "/account/workspaces/create/expert",
      "/onboarding",
    ]) {
      const res = await proxy(makeRequest(path))
      expect([301, 302], path).not.toContain(res.status)
      expect(res.headers.get("x-middleware-rewrite"), path).toContain(
        "localhost:3006"
      )
    }
    // A username that only begins like a moved word is a public profile.
    const profile = await proxy(makeRequest("/bookings"))
    expect(profile.status).toBe(200)
    expect(await profile.json()).toEqual({ zone: "marketing" })
  })

  it("falls through to intl middleware for marketing paths", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/about"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ zone: "marketing" })
  })

  it("persists ELEVA_LOCALE=es from a prefixed marketing path", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/es", {
        headers: {
          host: "dev.eleva.care",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
      })
    )
    expect(res.status).toBe(200)
    const setCookie = res.headers.getSetCookie?.() ?? []
    const localeCookie = setCookie.find((c) => c.startsWith("ELEVA_LOCALE="))
    expect(localeCookie).toBeDefined()
    expect(localeCookie).toMatch(/^ELEVA_LOCALE=es\b/)
    expect(localeCookie).toMatch(/Domain=\.eleva\.care/i)
  })

  it("persists ELEVA_LOCALE=en for unprefixed marketing paths", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/about", {
        headers: {
          host: "dev.eleva.care",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
      })
    )
    expect(res.status).toBe(200)
    const setCookie = res.headers.getSetCookie?.() ?? []
    const localeCookie = setCookie.find((c) => c.startsWith("ELEVA_LOCALE="))
    expect(localeCookie).toBeDefined()
    expect(localeCookie).toMatch(/^ELEVA_LOCALE=en\b/)
  })

  it("does not persist ELEVA_LOCALE on RSC or prefetch requests", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const rsc = await proxy(
      makeRequest("/es", {
        headers: { host: "dev.eleva.care", RSC: "1", "Sec-Fetch-Mode": "cors" },
      })
    )
    expect(
      (rsc.headers.getSetCookie?.() ?? []).some((c) =>
        c.startsWith("ELEVA_LOCALE=")
      )
    ).toBe(false)

    const prefetch = await proxy(
      makeRequest("/es", {
        headers: {
          host: "dev.eleva.care",
          "Next-Router-Prefetch": "1",
          "Sec-Fetch-Dest": "empty",
        },
      })
    )
    expect(
      (prefetch.headers.getSetCookie?.() ?? []).some((c) =>
        c.startsWith("ELEVA_LOCALE=")
      )
    ).toBe(false)
  })

  it("upgrades a matching host-only ELEVA_LOCALE to Domain=.eleva.care", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/es", {
        cookieValues: { ELEVA_LOCALE: "es" },
        headers: {
          host: "dev.eleva.care",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
      })
    )
    const setCookie = res.headers.getSetCookie?.() ?? []
    const localeCookie = setCookie.find((c) => c.startsWith("ELEVA_LOCALE="))
    expect(localeCookie).toBeDefined()
    expect(localeCookie).toMatch(/^ELEVA_LOCALE=es\b/)
    expect(localeCookie).toMatch(/Domain=\.eleva\.care/i)
  })

  it("rewrites /login to account zone in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        account: "https://account.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/login"))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://account.eleva.care/login"
    )
  })

  it("rewrites /verify-email to account zone in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        account: "https://account.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/verify-email"))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://account.eleva.care/verify-email"
    )
  })

  it("rewrites /space/reports to app zone in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        app: "https://app.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/space/reports"))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://app.eleva.care/space/reports"
    )
  })

  it("redirects /login to local account port in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/login"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3006/login")
  })

  it("redirects /docs to local docs port in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/docs/guides"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3008/docs/guides"
    )
  })

  it("redirects /admin to admin subdomain", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/admin/payments"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3007/payments")
  })

  it("serves the public profile for an unauthenticated /:username", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(makeRequest("/clinica-mota"))
    expect(res.status).toBe(200)
    expect(intl).toHaveBeenCalledOnce()
  })

  it("serves the booking funnel for /:username/:eventSlug without a session", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(makeRequest("/anaquick/quick-chat"))
    expect(res.status).toBe(200)
    expect(intl).toHaveBeenCalledOnce()
  })

  it("keeps a signed-in /:slug on marketing (no dashboard at the root)", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/clinica-mota", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.status).toBe(200)
    expect(intl).toHaveBeenCalledOnce()
  })

  it("keeps a signed-in /:username on the public profile, not the expert app", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/barona-expert", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.status).toBe(200)
    expect(intl).toHaveBeenCalledOnce()
  })

  it("keeps an unknown public handle on marketing even with a session cookie", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/patimota", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.status).toBe(200)
    expect(intl).toHaveBeenCalledOnce()
  })

  it("rewrites /expert/:slug to the expert app", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/expert/barona-expert", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3003/expert/barona-expert"
    )
  })

  it("rewrites a clinician seat /expert/:clinic/* to expert zone in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        expert: "https://expert.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/expert/clinica-mota/schedule", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://expert.eleva.care/expert/clinica-mota/schedule"
    )
  })

  it("rewrites the clinic namespace to the team zone in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        team: "https://team.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/team/clinica-mota", {
        cookieNames: ["better-auth.session_token"],
      })
    )
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://team.eleva.care/team/clinica-mota"
    )
  })

  it("keeps bare / on marketing even when a session cookie is present", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/", {
        cookieNames: ["better-auth.session_token"],
        cookieValues: {
          "better-auth.session_token": "1",
          "eleva-last-org": "clinica-mota",
        },
        headers: {
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      })
    )
    expect(intl).toHaveBeenCalledOnce()
    expect(await res.json()).toEqual({ zone: "marketing" })
  })

  it("does not treat an empty session cookie as signed-in on /", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/", {
        cookieNames: ["better-auth.session_token"],
        cookieValues: { "better-auth.session_token": "" },
        headers: {
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      })
    )
    expect(intl).toHaveBeenCalledOnce()
    expect(await res.json()).toEqual({ zone: "marketing" })
  })

  it("does not redirect bare / for RSC fetches (uses intl instead)", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/", {
        cookieNames: ["better-auth.session_token"],
        headers: { RSC: "1", "Sec-Fetch-Mode": "cors" },
      })
    )
    expect(intl).toHaveBeenCalledOnce()
    expect(await res.json()).toEqual({ zone: "marketing" })
  })

  it("does not redirect locale root /pt for logged-in RSC navigation", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    await proxy(
      makeRequest("/pt", {
        cookieNames: ["better-auth.session_token"],
        headers: {
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      })
    )
    expect(intl).toHaveBeenCalledOnce()
  })
})
