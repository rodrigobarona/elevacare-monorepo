import { memoryAdapter } from "better-auth/adapters/memory"
import { testUtils } from "better-auth/plugins"
import { getTableName, is, Column, type Table } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"

/**
 * Eleva's own auth configuration (`createAuthForTest`: the same plugins and
 * the same request hook as production) on Better Auth's in-memory database.
 *
 * Nothing here is answered by a canned value. The lookups that read
 * Postgres directly are served from the same in-memory tables the auth
 * server writes: a small reader that understands the three queries
 * `api-auth.ts` makes, and plain functions for the two others.
 */

type Row = Record<string, unknown>
const memory: Record<string, Row[]> = {}
/** The model's rows, created on first use (the adapter asks by name). */
const tables = new Proxy(memory, {
  get(target, model: string) {
    target[model] ??= []
    return target[model]
  },
})

type Condition = { column: Column; value: unknown } | { all: Condition[] }

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (column: Column, value: unknown): Condition => ({ column, value }),
  and: (...all: Condition[]): Condition => ({ all }),
}))

/** `auth.member.userId` -> the row's `userId`, in the model `member`. */
function read(joined: Record<string, Row>, column: Column): unknown {
  const table = column.table as unknown as Table & Record<string, unknown>
  const field = Object.keys(table).find((key) => table[key] === column)
  if (!field) throw new Error(`unknown column ${column.name}`)
  return joined[getTableName(table)]?.[field]
}

function holds(joined: Record<string, Row>, condition: Condition): boolean {
  if ("all" in condition) return condition.all.every((c) => holds(joined, c))
  const wanted = is(condition.value, Column)
    ? read(joined, condition.value)
    : condition.value
  return read(joined, condition.column) === wanted
}

/** `select().from().innerJoin().where().limit()` over the memory tables. */
function memoryDb() {
  return {
    select: (shape: Record<string, Column>) => ({
      from: (first: Table) => {
        const sources = [first]
        const conditions: Condition[] = []
        const run = (limit: number) => {
          let joined: Record<string, Row>[] = [{}]
          for (const source of sources) {
            const name = getTableName(source)
            joined = joined.flatMap((left) =>
              tables[name]!.map((row) => ({ ...left, [name]: row }))
            )
          }
          return joined
            .filter((row) => conditions.every((c) => holds(row, c)))
            .slice(0, limit)
            .map((row) =>
              Object.fromEntries(
                Object.entries(shape).map(([key, column]) => [
                  key,
                  read(row, column),
                ])
              )
            )
        }
        const query = {
          innerJoin: (table: Table, on: Condition) => {
            sources.push(table)
            conditions.push(on)
            return query
          },
          where: (condition: Condition) => {
            conditions.push(condition)
            return { limit: async (limit: number) => run(limit) }
          },
        }
        return query
      },
    }),
  }
}

vi.mock("@eleva/db", async () => ({
  db: () => memoryDb(),
  auth: await import("@eleva/db/schema/auth"),
}))

function memberships(userId: string) {
  return tables.member!.filter((member) => member.userId === userId)
}
function organization(id: unknown) {
  return tables.organization!.find((org) => org.id === id)
}

vi.mock("../provision-personal-space", () => ({
  provisionPersonalSpace: async () => undefined,
  findDefaultOrganizationId: async (userId: string) => {
    const own = memberships(userId)
    const personal = own.find(
      (member) => organization(member.organizationId)?.type === "personal"
    )
    return (personal ?? own[0])?.organizationId ?? null
  },
}))

const instance = vi.hoisted(() => ({ api: null as unknown }))
vi.mock("./auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth")>()),
  // `api-auth.ts` asks the singleton; give it the instance under test.
  getAuthApi: () => instance.api,
}))

vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret-32")
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3002/auth")
vi.stubEnv("KV_REST_API_URL", "")
vi.stubEnv("KV_REST_API_TOKEN", "")

import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import { requireApiAuth, requireApiUser } from "./api-auth"
import { createAuthForTest } from "./auth"

const ORIGIN = "http://localhost:3002"
const HOUR = 3_600_000

interface Person {
  id: string
  email: string
  orgId: string
  slug: string
  /** `better-auth.session_token=…`, as a browser would send it. */
  cookie: string
  /** The session token, as `Authorization: Bearer` carries it. */
  bearer: string
}

type TestHelpers = {
  login: (input: {
    userId: string
  }) => Promise<{ headers: Headers; token: string }>
}

type KeyApi = {
  createApiKey: (opts: { body: Row }) => Promise<{ id: string; key: string }>
  updateApiKey: (opts: { body: Row }) => Promise<unknown>
  deleteApiKey: (opts: { body: Row; headers: Headers }) => Promise<unknown>
}

let auth: {
  handler: (request: Request) => Promise<Response>
  api: KeyApi
}
let helpers: TestHelpers
/** What a plugin hook saw of the request, to prove the order of the hooks. */
const seenByPluginHook: { path: string; sessionUserId: string | null }[] = []

beforeAll(async () => {
  const recorder = {
    id: "order-recorder",
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: async (ctx: {
            path: string
            context: { session?: { user: { id: string } } | null }
          }) => {
            seenByPluginHook.push({
              path: ctx.path,
              sessionUserId: ctx.context.session?.user.id ?? null,
            })
          },
        },
      ],
    },
  }
  const created = createAuthForTest({
    database: memoryAdapter(tables),
    plugins: [testUtils(), recorder],
    isStaff: async (userId) =>
      memberships(userId).some(
        (member) => organization(member.organizationId)?.type === "staff"
      ),
  }) as unknown as typeof auth & {
    $context: Promise<{ test: TestHelpers }>
  }
  auth = created
  instance.api = created.api
  helpers = (await created.$context).test
})

let counter = 0

async function person(
  options: {
    staff?: boolean
    sessionAgeHours?: number
    verified?: boolean
  } = {}
): Promise<Person> {
  counter += 1
  const email = `person-${counter}@example.test`
  // Written straight to the table: saving through Better Auth would run the
  // sign-up rules, which belong to a request.
  const user = {
    id: crypto.randomUUID(),
    email,
    name: `Person ${counter}`,
    image: null,
    emailVerified: options.verified ?? true,
    banned: false,
    banExpires: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  tables.user!.push(user)
  const orgId = crypto.randomUUID()
  const slug = `workspace-${counter}`
  tables.organization!.push({
    id: orgId,
    name: slug,
    slug,
    type: options.staff ? "staff" : "personal",
    createdAt: new Date(),
  })
  tables.member!.push({
    id: crypto.randomUUID(),
    userId: user.id,
    organizationId: orgId,
    role: "owner",
    createdAt: new Date(),
  })
  const login = await helpers.login({ userId: user.id })
  if (options.sessionAgeHours) {
    const session = tables.session!.find((row) => row.token === login.token)!
    session.createdAt = new Date(Date.now() - options.sessionAgeHours * HOUR)
  }
  return {
    id: user.id,
    email,
    orgId,
    slug,
    cookie: login.headers.get("cookie")!,
    bearer: login.token,
  }
}

/** `POST /auth/<path>` through the real handler, as a browser or an agent. */
async function post(path: string, headers: Record<string, string>, body: Row) {
  const response = await auth.handler(
    new Request(`${ORIGIN}/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  )
  const answer = (await response.json().catch(() => null)) as Row | null
  return { status: response.status, body: answer }
}

/** Mint a key, and say whose it is. */
async function mintKey(headers: Record<string, string>) {
  const { status, body } = await post("/api-key/create", headers, { name: "k" })
  return {
    status,
    code: body?.code as string | undefined,
    owner: body?.referenceId as string | undefined,
  }
}

async function keyFor(owner: Person, extra: Row = {}): Promise<string> {
  const created = await auth.api.createApiKey({
    body: { userId: owner.id, name: "agent", ...extra },
  })
  return created.key
}

function withKey(key: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3002/expert/profile", {
    headers: { "x-api-key": key, ...headers },
  })
}

describe("minting a key through the auth server (the staff session guard)", () => {
  const STALE = STAFF_DECISION_SIGN_IN_MAX_AGE_MS / HOUR + 1

  it("needs a session", async () => {
    expect(await mintKey({})).toMatchObject({ status: 401 })
    expect(
      await mintKey({ authorization: "Bearer not-a-session" })
    ).toMatchObject({ status: 401 })
  })

  it("mints for a staff member whose session started today, by cookie or bearer", async () => {
    const staff = await person({ staff: true })
    expect(await mintKey({ cookie: staff.cookie })).toEqual({
      status: 200,
      code: undefined,
      owner: staff.id,
    })
    expect(
      await mintKey({ authorization: `Bearer ${staff.bearer}` })
    ).toMatchObject({ status: 200, owner: staff.id })
  })

  it("refuses a staff member whose session is older, by cookie or bearer", async () => {
    const staff = await person({ staff: true, sessionAgeHours: STALE })
    expect(await mintKey({ cookie: staff.cookie })).toMatchObject({
      status: 403,
      code: "STEP_UP_REQUIRED",
    })
    expect(
      await mintKey({ authorization: `Bearer ${staff.bearer}` })
    ).toMatchObject({ status: 403, code: "STEP_UP_REQUIRED" })
    // The same for another way to a new credential.
    expect(
      await post("/api-key/update", { cookie: staff.cookie }, { keyId: "x" })
    ).toMatchObject({ status: 403, body: { code: "STEP_UP_REQUIRED" } })
  })

  it("asks nobody but staff", async () => {
    const member = await person({ sessionAgeHours: 24 * 20 })
    expect(await mintKey({ cookie: member.cookie })).toMatchObject({
      status: 200,
      owner: member.id,
    })
  })

  it("refuses when either of two sessions on one request is an old staff one", async () => {
    const oldStaff = await person({ staff: true, sessionAgeHours: STALE })
    const member = await person()
    expect(
      await mintKey({
        cookie: member.cookie,
        authorization: `Bearer ${oldStaff.bearer}`,
      })
    ).toMatchObject({ status: 403, code: "STEP_UP_REQUIRED" })
    expect(
      await mintKey({
        cookie: oldStaff.cookie,
        authorization: `Bearer ${member.bearer}`,
      })
    ).toMatchObject({ status: 403, code: "STEP_UP_REQUIRED" })
  })

  it("runs the guard before any plugin hook, and the endpoint acts for the session the guard read", async () => {
    const staff = await person({ staff: true })
    const member = await person()
    seenByPluginHook.length = 0
    const minted = await mintKey({
      cookie: staff.cookie,
      authorization: `Bearer ${member.bearer}`,
    })
    // The bearer plugin would hand the endpoint the member's session. The
    // guard ran first, read the cookie's session from the store, and Better
    // Auth keeps that answer for the rest of the request: the plugin hooks
    // already see it, and the key is the staff member's.
    expect(seenByPluginHook).toContainEqual({
      path: "/api-key/create",
      sessionUserId: staff.id,
    })
    expect(minted).toMatchObject({ status: 200, owner: staff.id })
  })

  it("refuses a session that was revoked while the browser still holds its cached copy", async () => {
    const staff = await person({ staff: true })
    // A page load makes the browser hold the 5-minute signed copy.
    const page = await auth.handler(
      new Request(`${ORIGIN}/auth/get-session`, {
        headers: { cookie: staff.cookie, origin: ORIGIN },
      })
    )
    const cached = page.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .filter((cookie) => cookie?.includes("session_data"))
    expect(cached).toHaveLength(1)
    // Signed out everywhere, banned, or a password reset: the row is gone.
    tables.session!.splice(
      tables.session!.findIndex((row) => row.token === staff.bearer),
      1
    )
    expect(
      await mintKey({ cookie: `${staff.cookie}; ${cached[0]}` })
    ).toMatchObject({ status: 401 })
  })

  it("never lets a key mint or change a key", async () => {
    const owner = await person()
    const key = await keyFor(owner)
    expect(await mintKey({ "x-api-key": key })).toMatchObject({ status: 401 })
    expect(
      await post("/api-key/update", { "x-api-key": key }, { keyId: "x" })
    ).toMatchObject({ status: 401 })
  })
})

describe("signing in to the API with a key", () => {
  it("is the person who owns the key, in their default workspace", async () => {
    const owner = await person()
    const identity = await requireApiAuth(withKey(await keyFor(owner)))
    expect(identity).toMatchObject({
      authMode: "api-key",
      authenticatedAt: null,
      user: { id: owner.id, email: owner.email },
      orgId: owner.orgId,
      orgSlug: owner.slug,
    })
  })

  it("acts in a workspace the request names only when the owner belongs to it", async () => {
    const owner = await person({ staff: true })
    const other = await person()
    const key = await keyFor(owner)
    expect(
      await requireApiAuth(withKey(key, { "x-eleva-org": owner.slug }))
    ).toMatchObject({ orgId: owner.orgId, orgType: "staff" })
    await expect(
      requireApiAuth(withKey(key, { "x-eleva-org": other.slug }))
    ).rejects.toMatchObject({ code: "not-a-member" })
  })

  it("keeps working past ten requests a day (the plugin's own limit is off)", async () => {
    const owner = await person()
    const key = await keyFor(owner)
    for (let request = 1; request <= 12; request += 1) {
      await expect(requireApiAuth(withKey(key))).resolves.toMatchObject({
        user: { id: owner.id },
      })
    }
  })

  it("refuses a key that is unknown, deleted, disabled or expired", async () => {
    const owner = await person()
    await expect(requireApiAuth(withKey("x".repeat(64)))).rejects.toMatchObject(
      { code: "invalid-token" }
    )

    const deleted = await keyFor(owner)
    tables.apikey!.splice(0, tables.apikey!.length)
    await expect(requireApiAuth(withKey(deleted))).rejects.toMatchObject({
      code: "invalid-token",
    })

    const disabled = await auth.api.createApiKey({
      body: { userId: owner.id, name: "off" },
    })
    await auth.api.updateApiKey({
      body: { keyId: disabled.id, userId: owner.id, enabled: false },
    })
    await expect(requireApiAuth(withKey(disabled.key))).rejects.toMatchObject({
      code: "invalid-token",
    })

    const expired = await keyFor(owner, { expiresIn: 60 * 60 * 24 })
    tables.apikey!.find((row) => row.name === "agent")!.expiresAt = new Date(
      Date.now() - 1000
    )
    for (const attempt of [1, 2]) {
      await expect(
        requireApiAuth(withKey(expired)),
        `attempt ${attempt}`
      ).rejects.toMatchObject({ code: "invalid-token" })
    }
  })

  it("stops at once when the owner is banned, deleted or loses the workspace", async () => {
    const banned = await person()
    const bannedKey = await keyFor(banned)
    tables.user!.find((row) => row.id === banned.id)!.banned = true
    // The plugin still calls this key valid: it checks nothing about its owner.
    await expect(requireApiAuth(withKey(bannedKey))).rejects.toMatchObject({
      code: "invalid-token",
    })

    const gone = await person()
    const goneKey = await keyFor(gone)
    tables.user!.splice(
      tables.user!.findIndex((row) => row.id === gone.id),
      1
    )
    await expect(requireApiAuth(withKey(goneKey))).rejects.toMatchObject({
      code: "invalid-token",
    })

    const removed = await person({ staff: true })
    const removedKey = await keyFor(removed)
    await expect(requireApiAuth(withKey(removedKey))).resolves.toMatchObject({
      orgType: "staff",
    })
    tables.member!.splice(
      tables.member!.findIndex((row) => row.userId === removed.id),
      1
    )
    await expect(requireApiAuth(withKey(removedKey))).rejects.toMatchObject({
      code: "no-session",
    })
  })

  it("refuses a key whose owner never verified their address", async () => {
    const unverified = await person({ verified: false })
    await expect(
      requireApiAuth(withKey(await keyFor(unverified)))
    ).rejects.toMatchObject({ code: "invalid-token" })
  })

  it("never reads an organization's id, or an old row, as a person", async () => {
    const owner = await person()
    const key = await keyFor(owner)
    const row = tables.apikey!.find((entry) => entry.referenceId === owner.id)!
    // A row from before the plugin changed: an organization in `referenceId`.
    row.referenceId = owner.orgId
    await expect(requireApiAuth(withKey(key))).rejects.toMatchObject({
      code: "invalid-token",
    })
    // A key of a configuration whose owners are organizations.
    row.referenceId = owner.id
    row.configId = "organization-keys"
    await expect(requireApiAuth(withKey(key))).rejects.toThrow()
  })

  it("is one credential, sent in its own header", async () => {
    const owner = await person()
    const key = await keyFor(owner)
    const besideTheKey: Record<string, string>[] = [
      { cookie: owner.cookie },
      { authorization: `Bearer ${owner.bearer}` },
    ]
    for (const extra of besideTheKey) {
      await expect(requireApiAuth(withKey(key, extra))).rejects.toMatchObject({
        code: "ambiguous-credentials",
      })
    }
    // Sent as a bearer token, a key is not a session.
    await expect(
      requireApiAuth(
        new Request("http://localhost:3002/expert/profile", {
          headers: { authorization: `Bearer ${key}` },
        })
      )
    ).rejects.toMatchObject({ code: "invalid-token" })
    // Onboarding takes a signed-in person, never a key.
    await expect(requireApiUser(withKey(key))).rejects.toMatchObject({
      code: "missing-capability",
    })
  })

  it("still signs in with a cookie or a bearer session on the same instance", async () => {
    const owner = await person()
    await expect(
      requireApiAuth(
        new Request("http://localhost:3002/expert/profile", {
          headers: { cookie: owner.cookie, "sec-fetch-site": "same-origin" },
        })
      )
    ).resolves.toMatchObject({ authMode: "cookie", user: { id: owner.id } })
    const viaBearer = await requireApiAuth(
      new Request("http://localhost:3002/expert/profile", {
        headers: { authorization: `Bearer ${owner.bearer}` },
      })
    )
    expect(viaBearer).toMatchObject({
      authMode: "bearer",
      user: { id: owner.id },
    })
    expect(viaBearer.authenticatedAt).toBeInstanceOf(Date)
  })
})
