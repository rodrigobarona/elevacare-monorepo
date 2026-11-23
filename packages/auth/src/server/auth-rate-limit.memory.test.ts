import { memoryAdapter } from "better-auth/adapters/memory"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { RATE_LIMITED_CODE } from "../rate-limited"
import type { AuthSecondaryStorage } from "./secondary-storage"

/**
 * The sign-in limits (slice 13.5), driven through Eleva's own auth
 * configuration: the same plugins, the same rules, the same way of
 * counting as production (a counter in a store that sets its end once,
 * when it is created), on a store kept in memory. Nothing about the
 * limiter is replaced.
 */

vi.mock("@eleva/db", async () => ({
  db: () => {
    throw new Error("the limiter answers before anything reads Postgres")
  },
  auth: await import("@eleva/db/schema/auth"),
}))
vi.mock("../provision-personal-space", () => ({
  provisionPersonalSpace: async () => undefined,
  findDefaultOrganizationId: async () => null,
}))

vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-32")
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3002/auth")
vi.stubEnv("KV_REST_API_URL", "")
vi.stubEnv("KV_REST_API_TOKEN", "")

import { createAuthForTest, withCors, withRetryAfter } from "./auth"
import {
  AUTH_RATE_LIMIT_DEFAULT,
  AUTH_RATE_LIMIT_LONGEST_WAIT,
  AUTH_RATE_LIMIT_RULES,
  type AuthRateLimitRule,
} from "./rate-limit-rules"

const ORIGIN = "http://localhost:3006"

/**
 * Redis, as far as Better Auth uses it: values that end, and a counter
 * whose end is set only when it is created (`INCR` + `EXPIRE NX`).
 */
function memoryStorage(): AuthSecondaryStorage & { keys(): string[] } {
  const kept = new Map<string, { value: string; endsAt: number | null }>()
  const live = (key: string) => {
    const entry = kept.get(key)
    if (entry && entry.endsAt !== null && entry.endsAt <= Date.now()) {
      kept.delete(key)
      return undefined
    }
    return entry
  }
  return {
    get: async (key) => live(key)?.value ?? null,
    set: async (key, value, ttl) => {
      kept.set(key, { value, endsAt: ttl ? Date.now() + ttl * 1000 : null })
    },
    delete: async (key) => {
      kept.delete(key)
    },
    getAndDelete: async (key) => {
      const value = live(key)?.value ?? null
      kept.delete(key)
      return value
    },
    increment: async (key, ttl) => {
      const entry = live(key)
      if (!entry) {
        kept.set(key, { value: "1", endsAt: Date.now() + ttl * 1000 })
        return 1
      }
      entry.value = String(Number(entry.value) + 1)
      return Number(entry.value)
    },
    keys: () => [...kept.keys()],
  }
}

type Handler = { handler: (request: Request) => Promise<Response> }
let auth: Handler & { api: Record<string, { path?: string }> }
const storage = memoryStorage()

beforeAll(() => {
  auth = createAuthForTest({
    database: memoryAdapter({}),
    secondaryStorage: storage,
  }) as unknown as typeof auth
})

beforeEach(() => {
  // Only the clock: the handler itself waits on real timers.
  vi.useFakeTimers({ toFake: ["Date"] })
})
afterEach(() => {
  vi.useRealTimers()
})

let office = 0
/** A new address for each test, so that no count carries over. */
const newAddress = () => `203.0.113.${(office += 1)}`

function ask(path: string, ip: string, method: "GET" | "POST" = "POST") {
  return auth.handler(
    new Request(`${ORIGIN}/auth${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-vercel-forwarded-for": ip,
      },
      // The limiter answers before a body is read: an empty one will do.
      body: method === "POST" ? "{}" : undefined,
    })
  )
}

/** A real path for each rule: a rule with a star is tried on one it covers. */
const PATH_FOR: Record<keyof typeof AUTH_RATE_LIMIT_RULES, string> = {
  "/sign-in/email": "/sign-in/email",
  "/sign-in/magic-link": "/sign-in/magic-link",
  "/sign-in/social": "/sign-in/social",
  "/sign-in/*": "/sign-in/anything-new",
  "/sign-up/email": "/sign-up/email",
  "/sign-up/*": "/sign-up/anything-new",
  "/magic-link/verify": "/magic-link/verify",
  "/verify-email": "/verify-email",
  "/request-password-reset": "/request-password-reset",
  "/send-verification-email": "/send-verification-email",
  "/change-email": "/change-email",
  "/reset-password": "/reset-password",
  "/verify-password": "/verify-password",
  "/change-password": "/change-password",
  "/two-factor/send-otp": "/two-factor/send-otp",
  "/two-factor/*": "/two-factor/verify-totp",
  "/passkey/verify-authentication": "/passkey/verify-authentication",
  "/organization/invite-member": "/organization/invite-member",
}
const GET_PATHS = new Set(["/magic-link/verify", "/verify-email"])

const CASES = Object.entries(AUTH_RATE_LIMIT_RULES).map(
  ([rule, limit]) =>
    [rule, PATH_FOR[rule as keyof typeof PATH_FOR], limit] as [
      string,
      string,
      AuthRateLimitRule,
    ]
)

describe("the sign-in limits, as the auth server applies them", () => {
  it.each(CASES)(
    "%s: its number passes, the next is told how long to wait, and the wait ends",
    async (_rule, path, { window, max }) => {
      const here = newAddress()
      const method = GET_PATHS.has(path) ? "GET" : "POST"
      for (let count = 1; count <= max; count += 1) {
        const allowed = await ask(path, here, method)
        expect(allowed.status, `request ${count} of ${max}`).not.toBe(429)
      }
      const refused = await ask(path, here, method)
      expect(refused.status).toBe(429)
      expect(refused.headers.get("x-retry-after")).toBe(String(window))

      // Another office, the same minute, is not held up.
      expect((await ask(path, newAddress(), method)).status).not.toBe(429)

      // One second before the window ends it still holds; then it is over.
      vi.setSystemTime(Date.now() + (window - 1) * 1000)
      expect((await ask(path, here, method)).status).toBe(429)
      vi.setSystemTime(Date.now() + 1000)
      expect((await ask(path, here, method)).status).not.toBe(429)
    }
  )

  it("counts each path on its own: held on the password, a sign-in link still works", async () => {
    const here = newAddress()
    const { max } = AUTH_RATE_LIMIT_RULES["/sign-in/email"]
    for (let count = 0; count <= max; count += 1) {
      await ask("/sign-in/email", here)
    }
    expect((await ask("/sign-in/email", here)).status).toBe(429)
    expect((await ask("/sign-in/magic-link", here)).status).not.toBe(429)
    expect((await ask("/sign-in/social", here)).status).not.toBe(429)
  })

  it("leaves reading a session, and signing out, on the wide default", async () => {
    const here = newAddress()
    // More than any rule above allows in a minute.
    for (let count = 0; count < 40; count += 1) {
      expect((await ask("/get-session", here, "GET")).status).not.toBe(429)
    }
    for (let count = 0; count < 40; count += 1) {
      expect((await ask("/sign-out", here)).status).not.toBe(429)
    }
    expect(AUTH_RATE_LIMIT_DEFAULT).toEqual({ window: 10, max: 100 })
  })

  it("keys a count by the address and the path, without the /auth prefix", async () => {
    const here = newAddress()
    await ask("/sign-in/email", here)
    expect(storage.keys()).toContain(`${here}|/sign-in/email`)
  })
})

describe("the rules and the installed Better Auth agree", () => {
  /** Every endpoint the instance serves, by its path. */
  const endpoints = () =>
    new Set(
      Object.values(auth.api)
        .map((endpoint) => endpoint?.path)
        .filter((path): path is string => typeof path === "string")
    )

  it("every path named in a rule is an endpoint", () => {
    const served = endpoints()
    expect(served.size).toBeGreaterThan(50)
    for (const rule of Object.keys(AUTH_RATE_LIMIT_RULES)) {
      if (rule.includes("*")) continue
      // A rename in a release (`/forget-password` became
      // `/request-password-reset`) would leave a rule that matches nothing.
      expect(served.has(rule), `${rule} is served`).toBe(true)
    }
  })

  /**
   * Endpoints left on the wide default (100 in 10 seconds), each for a
   * reason. An endpoint that is in no rule and not here fails the test
   * below: a release that adds one asks for a decision.
   */
  const ON_THE_DEFAULT: Record<string, string[]> = {
    "read by every page that is signed in, or must never be refused": [
      "/get-session",
      "/sign-out",
    ],
    "tokens for a session that is already signed in": [
      "/token",
      "/jwks",
      "/refresh-token",
      "/get-access-token",
    ],
    "pages and documents with nothing to guess": [
      "/ok",
      "/error",
      "/reference",
      "/open-api/generate-schema",
    ],
    "a browser arriving from a provider or from a link in an email, with a token of its own":
      ["/callback/:id", "/reset-password/:token", "/delete-user/callback"],
    "needs a signed-in session, and sends nothing to anyone else": [
      "/list-sessions",
      "/list-accounts",
      "/account-info",
      "/revoke-session",
      "/revoke-sessions",
      "/revoke-other-sessions",
      "/update-session",
      "/update-user",
      "/unlink-account",
      "/link-social",
      "/delete-user",
    ],
    "needs a signed-in member of the organization (inviting has its own rule)":
      ["/organization/*"],
    "needs a staff session": ["/admin/*"],
    "needs a signed-in session; a key is checked on the server, not here": [
      "/api-key/*",
    ],
    "a passkey cannot be guessed (signing in with one has its own rule)": [
      "/passkey/*",
    ],
  }

  const matches = (pattern: string, path: string) =>
    pattern.includes("*")
      ? new RegExp(`^${pattern.replace("*", "[^/]+")}$`).test(path)
      : pattern === path

  it("every endpoint has a rule, or a reason to be on the default", () => {
    const rules = Object.keys(AUTH_RATE_LIMIT_RULES)
    const fine = Object.values(ON_THE_DEFAULT).flat()
    const undecided = [...endpoints()].filter(
      (path) =>
        !rules.some((rule) => matches(rule, path)) &&
        !fine.some((pattern) => matches(pattern, path))
    )
    expect(undecided).toEqual([])
    // And nothing listed as fine is a name from an older release.
    for (const pattern of fine) {
      expect(
        [...endpoints()].some((path) => matches(pattern, path)),
        `${pattern} is served`
      ).toBe(true)
    }
  })

  it("every endpoint that signs in, signs up, takes a code or sends an email has a rule", () => {
    const rules = Object.keys(AUTH_RATE_LIMIT_RULES)
    const covered = (path: string) => rules.some((rule) => matches(rule, path))
    const sensitive = [...endpoints()].filter((path) =>
      /^\/(sign-in|sign-up|two-factor)\//.test(path)
    )
    expect(sensitive.length).toBeGreaterThanOrEqual(8)
    for (const path of sensitive) expect(covered(path), path).toBe(true)
    for (const path of [
      "/request-password-reset",
      "/send-verification-email",
      "/reset-password",
      "/verify-password",
      "/change-password",
      "/change-email",
      "/magic-link/verify",
      "/verify-email",
      "/organization/invite-member",
    ]) {
      expect(endpoints().has(path), `${path} is served`).toBe(true)
      expect(covered(path), path).toBe(true)
    }
  })

  it("a path comes before the pattern that also covers it", () => {
    const rules = Object.keys(AUTH_RATE_LIMIT_RULES)
    for (const [index, rule] of rules.entries()) {
      if (!rule.includes("*")) continue
      const pattern = new RegExp(`^${rule.replace("*", "[^/]+")}$`)
      for (const later of rules.slice(index + 1)) {
        expect(pattern.test(later), `${later} after ${rule}`).toBe(false)
      }
    }
  })

  it("nobody waits more than a minute for what they do themselves", () => {
    expect(AUTH_RATE_LIMIT_LONGEST_WAIT).toBe(60)
    // A link opened from an email has more room than a password try.
    expect(AUTH_RATE_LIMIT_RULES["/magic-link/verify"].max).toBeGreaterThan(
      AUTH_RATE_LIMIT_RULES["/sign-in/email"].max
    )
  })
})

describe("what a refused caller is told", () => {
  it("how long, in the body and in a header a browser may read", async () => {
    const here = newAddress()
    const { max, window } = AUTH_RATE_LIMIT_RULES["/request-password-reset"]
    for (let count = 0; count < max; count += 1) {
      await ask("/request-password-reset", here)
    }
    const refused = await withRetryAfter(
      await ask("/request-password-reset", here)
    )
    expect(refused.status).toBe(429)
    expect(refused.headers.get("retry-after")).toBe(String(window))
    expect(refused.headers.get("x-retry-after")).toBe(String(window))
    expect(await refused.json()).toEqual({
      code: RATE_LIMITED_CODE,
      message: "Too many requests. Please try again later.",
      retryAfter: window,
    })
  })

  it("through the wrapper every answer leaves by, a browser on another origin can read it", async () => {
    const here = newAddress()
    const leave = withCors((request) => auth.handler(request))
    const send = () =>
      leave(
        new Request(`${ORIGIN}/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            "x-vercel-forwarded-for": here,
          },
          body: "{}",
        })
      )
    const { max, window } = AUTH_RATE_LIMIT_RULES["/sign-up/email"]
    for (let count = 0; count < max; count += 1) await send()
    const refused = await send()
    expect(refused.status).toBe(429)
    // The sign-in screens are on another origin than the API.
    expect(refused.headers.get("access-control-allow-origin")).toBe(ORIGIN)
    expect(
      refused.headers
        .get("access-control-expose-headers")
        ?.split(",")
        .map((name) => name.trim().toLowerCase())
    ).toEqual(["retry-after", "x-retry-after"])
    expect(refused.headers.get("retry-after")).toBe(String(window))
    expect(await refused.json()).toMatchObject({
      code: RATE_LIMITED_CODE,
      retryAfter: window,
    })
    // An answer that is not a refusal names the same readable headers.
    const allowed = await withCors(async () => Response.json({ ok: true }))(
      new Request(`${ORIGIN}/auth/ok`, { headers: { origin: ORIGIN } })
    )
    expect(allowed.headers.get("access-control-expose-headers")).toContain(
      "Retry-After"
    )
  })

  it("leaves every other answer as it was", async () => {
    const ok = Response.json({ status: true })
    expect(await withRetryAfter(ok)).toBe(ok)
    // The second step's lock is a 429 with its own code and no time.
    const locked = Response.json(
      { code: "ACCOUNT_TEMPORARILY_LOCKED", message: "locked" },
      { status: 429 }
    )
    expect(await withRetryAfter(locked)).toBe(locked)
    const odd = new Response("nope", {
      status: 429,
      headers: { "x-retry-after": "soon" },
    })
    expect(await withRetryAfter(odd)).toBe(odd)
  })
})
