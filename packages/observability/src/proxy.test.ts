import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { PASSTHROUGH_APP_MATCHER, STANDARD_APP_MATCHER } from "./proxy"

const CANONICAL_LITERAL = '["/((?!api|_next|_vercel|.*\\\\..*).*)"]'

describe("STANDARD_APP_MATCHER / PASSTHROUGH_APP_MATCHER", () => {
  it("exports the canonical regex", () => {
    expect(STANDARD_APP_MATCHER).toEqual(["/((?!api|_next|_vercel|.*\\..*).*)"])
    expect(PASSTHROUGH_APP_MATCHER).toEqual([
      "/((?!api|_next|_vercel|.*\\..*).*)",
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
