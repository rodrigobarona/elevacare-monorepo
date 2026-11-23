import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"
import { generateOpenApiSpec } from "./openapi"

const APP_DIR = join(__dirname, "..", "app")

/** Routes documented elsewhere or not part of the public contract. */
const UNDOCUMENTED = new Set([
  "/auth/{...all}",
  "/auth/ok",
  "/auth/e2e/verify-email",
  "/openapi.json",
])

function routeFiles(dir: string): { path: string; file: string }[] {
  const out: { path: string; file: string }[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === "route.ts") {
      const rel = relative(APP_DIR, dir)
        .split(sep)
        .filter((segment) => !/^\(.+\)$/.test(segment))
        .join("/")
      out.push({
        path: `/${rel}`.replace(/\[([^\]]+)\]/g, "{$1}"),
        file: full,
      })
    }
  }
  return out
}

function routePaths(dir: string): string[] {
  return routeFiles(dir).map((route) => route.path)
}

/**
 * A route in a class that refuses requests when the limiter's store is down
 * (`isRateLimitFailClosed`): it names the class itself, or reads through
 * `handlePublicGet`, which does.
 */
const FAIL_CLOSED_ROUTE =
  /RATE_LIMITS\.(public|publicSsr|webhook)\b|\bhandlePublicGet\(/

/** Every documented operation, with whether its route file is fail-closed. */
function operationsByLimiterPolicy() {
  const paths = generateOpenApiSpec().paths ?? {}
  const out: {
    name: string
    failClosed: boolean
    unavailable: string | undefined
  }[] = []
  for (const { path, file } of routeFiles(APP_DIR)) {
    const failClosed = FAIL_CLOSED_ROUTE.test(readFileSync(file, "utf8"))
    for (const [method, operation] of Object.entries(paths[path] ?? {})) {
      const responses = (
        operation as { responses?: Record<string, { description?: string }> }
      ).responses
      out.push({
        name: `${method.toUpperCase()} ${path}`,
        failClosed,
        unavailable: responses?.["503"]?.description,
      })
    }
  }
  return out
}

describe("OpenAPI coverage", () => {
  it("documents every apps/api route handler", () => {
    const documented = new Set(Object.keys(generateOpenApiSpec().paths ?? {}))
    const missing = routePaths(APP_DIR)
      .filter((path) => !UNDOCUMENTED.has(path) && !documented.has(path))
      .sort()
    expect(missing).toEqual([])
  })

  it("documents the 503 of every route that refuses when the limiter is down", () => {
    const failClosed = operationsByLimiterPolicy().filter(
      (operation) => operation.failClosed
    )
    // The search must find the routes it is about, or it proves nothing.
    expect(failClosed.map((operation) => operation.name)).toEqual(
      expect.arrayContaining([
        "GET /public/experts",
        "POST /bookings/reserve",
        "POST /webhooks/daily",
      ])
    )
    expect(
      failClosed
        .filter(
          (operation) =>
            !operation.unavailable?.includes("rate_limit_unavailable")
        )
        .map((operation) => operation.name)
        .sort()
    ).toEqual([])
  })

  it("does not promise that 503 on a route that lets requests through", () => {
    // `/calendar/feed/{token}` is public but in a class that fails open.
    expect(
      operationsByLimiterPolicy()
        .filter(
          (operation) =>
            !operation.failClosed &&
            operation.unavailable?.includes("rate_limit_unavailable")
        )
        .map((operation) => operation.name)
        .sort()
    ).toEqual([])
  })

  it("keeps each route's own reason for a 503 beside the limiter's", () => {
    const own = Object.fromEntries(
      operationsByLimiterPolicy().map((operation) => [
        operation.name,
        operation.unavailable,
      ])
    )
    expect(own["POST /bookings/reserve"]).toContain(
      "Reservation lock unavailable"
    )
    expect(own["POST /payments/intent"]).toContain("Stripe or snapshot")
    expect(own["POST /payments/checkout-session"]).toContain(
      "Stripe or snapshot"
    )
    expect(own["POST /bookings/confirm"]).toContain("Stripe retrieve")
  })

  it("describes clinic checkout as the code runs it", () => {
    const checkout = generateOpenApiSpec().paths?.["/billing/checkout"]?.post
    expect(checkout?.description).toContain("ui_mode=embedded_page")
    expect(checkout?.description).toContain("counted by Eleva")
    // The buyer never names how many seats to pay for.
    expect(JSON.stringify(checkout?.requestBody)).not.toContain("quantity")
    expect(
      JSON.stringify(
        generateOpenApiSpec().paths?.["/billing/subscribe"]?.post?.requestBody
      )
    ).not.toContain("quantity")
  })
})
