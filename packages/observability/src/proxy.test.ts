import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import {
  isCrossOriginRewrite,
  isVideoJoinPath,
  joinPermissionsPolicy,
  PASSTHROUGH_APP_MATCHER,
  STANDARD_APP_MATCHER,
  withHeaders,
} from "./proxy"

const CANONICAL_LITERAL = '["/((?!api/|_next|_vercel|.*\\\\..*).*)"]'

describe("isVideoJoinPath", () => {
  it("matches member and expert session join routes only", () => {
    expect(
      isVideoJoinPath(
        "/acme/sessions/11111111-1111-4111-8111-111111111111/join"
      )
    ).toBe(true)
    expect(
      isVideoJoinPath("/acme/sessions/11111111-1111-4111-8111-111111111111")
    ).toBe(false)
    expect(isVideoJoinPath("/acme/calendar")).toBe(false)
    expect(isVideoJoinPath("/join/11111111-1111-4111-8111-111111111111")).toBe(
      true
    )
    expect(isVideoJoinPath("/join")).toBe(false)
  })
})

describe("joinPermissionsPolicy", () => {
  it("allows camera and mic on Daily plus a branded DAILY_DOMAIN", () => {
    const prev = process.env.DAILY_DOMAIN
    process.env.DAILY_DOMAIN = "sessions.eleva.care"
    try {
      const policy = joinPermissionsPolicy()
      expect(policy).toContain(
        'camera=(self "https://*.daily.co" "https://sessions.eleva.care")'
      )
      expect(policy).toContain(
        'microphone=(self "https://*.daily.co" "https://sessions.eleva.care")'
      )
    } finally {
      if (prev === undefined) delete process.env.DAILY_DOMAIN
      else process.env.DAILY_DOMAIN = prev
    }
  })
})

describe("STANDARD_APP_MATCHER / PASSTHROUGH_APP_MATCHER", () => {
  it("exports the canonical regex", () => {
    expect(STANDARD_APP_MATCHER).toEqual([
      "/((?!api/|_next|_vercel|.*\\..*).*)",
    ])
    expect(PASSTHROUGH_APP_MATCHER).toEqual([
      "/((?!api/|_next|_vercel|.*\\..*).*)",
    ])
  })

  it("STANDARD and PASSTHROUGH currently share the same regex", () => {
    expect(STANDARD_APP_MATCHER).toEqual(PASSTHROUGH_APP_MATCHER)
  })
})

/**
 * Repo-wide consistency check: every app's `src/proxy.ts` MUST inline
 * the canonical matcher literal. This is the enforcement mechanism for
 * the audit "standardize matchers across apps" item -- Next.js' static
 * analyzer rejects imported matcher constants, so we cannot share via
 * an import. Instead, we share via this assertion.
 *
 * Exceptions:
 *   - apps/web (the gateway) uses a STRING matcher with an extra
 *     `trpc` exclusion. It is the only intentional exception.
 *   - apps/api uses `/:path*` because it is a /api-only app.
 *   - apps/app uses a wider matcher (no `api` exclusion) because the
 *     member app's proxy must also run on its own /api routes.
 */
describe("repo-wide proxy matcher consistency", () => {
  const repoRoot = resolve(__dirname, "../../..")
  const appsDir = join(repoRoot, "apps")

  const KNOWN_EXCEPTIONS = new Set([
    "web", // gateway: includes trpc, uses string form
    "api", // api-only: uses /:path*
    "app", // member app: no api exclusion
    "poc", // unauthenticated design POC: no proxy.ts at all
    "email", // React Email CLI preview: not a Next.js app
  ])

  const appNames = readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !KNOWN_EXCEPTIONS.has(name))

  for (const name of appNames) {
    it(`apps/${name}/src/proxy.ts inlines the canonical matcher`, () => {
      const path = join(appsDir, name, "src", "proxy.ts")
      const src = readFileSync(path, "utf8")
      expect(
        src,
        `apps/${name}/src/proxy.ts must contain the canonical matcher literal ${CANONICAL_LITERAL}. ` +
          `If a different matcher is intentional, add the app name to KNOWN_EXCEPTIONS in this test.`
      ).toContain(CANONICAL_LITERAL)
    })
  }
})

describe("withHeaders", () => {
  const req = (path: string) =>
    new NextRequest(new URL(path, "https://dev.eleva.care"))

  it("sets frame, sniffing and CSP headers on pages the app serves", async () => {
    const proxy = withHeaders(() => NextResponse.next(), {
      skipCrossOriginRewrites: true,
    })
    const res = await proxy(req("/pt/legal/privacy"))
    expect(res.headers.get("X-Frame-Options")).toBe("DENY")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'"
    )
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()")
  })

  it("keeps same-origin rewrites in scope", async () => {
    const proxy = withHeaders(
      (r) => NextResponse.rewrite(new URL("/home", r.nextUrl.origin)),
      { skipCrossOriginRewrites: true }
    )
    const res = await proxy(req("/"))
    expect(res.headers.get("X-Frame-Options")).toBe("DENY")
  })

  it("leaves rewrites to another zone untouched when asked", async () => {
    const proxy = withHeaders(
      () => NextResponse.rewrite("https://expert.eleva.care/acme/calendar"),
      { skipCrossOriginRewrites: true }
    )
    const res = await proxy(req("/acme/calendar"))
    expect(res.headers.get("X-Frame-Options")).toBeNull()
    expect(res.headers.get("Content-Security-Policy")).toBeNull()
    expect(res.headers.get("x-correlation-id")).toBeTruthy()
  })

  it("detects cross-origin rewrites only", () => {
    const r = req("/x")
    expect(
      isCrossOriginRewrite(r, NextResponse.rewrite("https://app.eleva.care/x"))
    ).toBe(true)
    expect(
      isCrossOriginRewrite(r, NextResponse.rewrite("https://dev.eleva.care/y"))
    ).toBe(false)
    expect(isCrossOriginRewrite(r, NextResponse.next())).toBe(false)
  })
})
