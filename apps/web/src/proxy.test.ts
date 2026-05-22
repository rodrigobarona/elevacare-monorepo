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
      const value = values[key]
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

  it("falls through to intl middleware for marketing paths", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/about"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ zone: "marketing" })
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

  it("redirects unauthenticated org slug to /login with returnTo", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(makeRequest("/clinica-mota"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fclinica-mota"
    )
  })

  it("redirects authenticated org slug to member app in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/clinica-mota", {
        cookieNames: ["wos-session"],
      })
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3001/clinica-mota"
    )
  })

  it("rewrites org-scoped expert route in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const proxy = createGatewayProxy({
      origins: {
        ...testOrigins,
        expert: "https://expert.eleva.care",
      },
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/clinica-mota/expert/schedule", {
        cookieNames: ["wos-session"],
      })
    )
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://expert.eleva.care/clinica-mota/expert/schedule"
    )
  })

  it("redirects bare / with session on document navigation", async () => {
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: marketingIntl,
    })
    const res = await proxy(
      makeRequest("/", {
        cookieNames: ["wos-session"],
        cookieValues: {
          "wos-session": "1",
          "eleva-last-org": "clinica-mota",
        },
        headers: {
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      })
    )
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/clinica-mota"
    )
  })

  it("does not redirect bare / for RSC fetches (uses intl instead)", async () => {
    const intl = vi.fn(marketingIntl)
    const proxy = createGatewayProxy({
      origins: testOrigins,
      intlMiddleware: intl,
    })
    const res = await proxy(
      makeRequest("/", {
        cookieNames: ["wos-session"],
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
        cookieNames: ["wos-session"],
        headers: {
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      })
    )
    expect(intl).toHaveBeenCalledOnce()
  })
})
