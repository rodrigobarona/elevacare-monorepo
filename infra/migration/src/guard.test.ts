import { describe, expect, it, vi } from "vitest"
import {
  assertMigrationTarget,
  MigrationGuardError,
  NeonLookupError,
  utcDate,
  type MigrationGuardDeps,
  type MigrationGuardEnv,
  type NeonEndpointInfo,
} from "./guard"

const PROJECT = "aged-wildflower-123456"
const REHEARSAL_HOST = "ep-rehearsal-a1b2c3d4.eu-central-1.aws.neon.tech"
const REHEARSAL_POOLED =
  "ep-rehearsal-a1b2c3d4-pooler.eu-central-1.aws.neon.tech"
const PRODUCTION_HOST = "ep-prod-z9y8x7w6.eu-central-1.aws.neon.tech"
const MVP_URL =
  "postgresql://reader:pw@ep-mvp-11112222.eu-west-2.aws.neon.tech/mvp"
/** The MVP URL as the guard hands it back: the port written out. */
const MVP_REBUILT =
  "postgresql://reader:pw@ep-mvp-11112222.eu-west-2.aws.neon.tech:5432/mvp"
const NOW = new Date("2026-11-21T23:30:00.000Z")

const ENDPOINTS: Record<string, NeonEndpointInfo> = {
  [REHEARSAL_HOST]: {
    endpointId: "ep-rehearsal-a1b2c3d4",
    projectId: PROJECT,
    branchId: "br-rehearsal",
    branchName: "rehearsal-2026-11-21",
    isDefaultBranch: false,
    isReadWrite: true,
  },
  [PRODUCTION_HOST]: {
    endpointId: "ep-prod-z9y8x7w6",
    projectId: PROJECT,
    branchId: "br-main",
    branchName: "main",
    isDefaultBranch: true,
    isReadWrite: true,
  },
}
ENDPOINTS[REHEARSAL_POOLED] = ENDPOINTS[REHEARSAL_HOST]!

/** Neon's answer for the rehearsal host only; the MVP host stays unknown. */
const forTarget =
  (answer: NeonEndpointInfo) =>
  async (host: string): Promise<NeonEndpointInfo | null> =>
    host === REHEARSAL_HOST ? answer : null

function deps(overrides: Partial<MigrationGuardDeps> = {}): MigrationGuardDeps {
  return {
    resolveEndpoint: vi.fn(async (host: string) => ENDPOINTS[host] ?? null),
    prompt: vi.fn(async () => PROJECT),
    isInteractive: () => true,
    now: () => NOW,
    ...overrides,
  }
}

function env(overrides: MigrationGuardEnv = {}): MigrationGuardEnv {
  return {
    TARGET_DATABASE_URL: `postgresql://app:pw@${REHEARSAL_HOST}/eleva`,
    MVP_DATABASE_URL: MVP_URL,
    NEON_PROJECT_ID: PROJECT,
    MIGRATION_ALLOWED_TARGET_HOSTS: REHEARSAL_HOST,
    ...overrides,
  }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof MigrationGuardError) return err
    throw err
  }
  throw new Error("expected the guard to refuse")
}

const production = (overrides: MigrationGuardEnv = {}) =>
  env({
    TARGET_DATABASE_URL: `postgresql://app:pw@${PRODUCTION_HOST}/eleva`,
    MIGRATION_CONFIRM_PRODUCTION: "2026-11-21",
    ...overrides,
  })

describe("rehearsal (--target branch)", () => {
  it("accepts an allowed branch of the production project, and never prompts", async () => {
    const d = deps()
    for (const mode of ["dry-run", "apply"] as const) {
      await expect(
        assertMigrationTarget({ target: "branch", mode, env: env() }, d)
      ).resolves.toEqual({
        kind: "branch",
        mode,
        host: REHEARSAL_HOST,
        sourceHost: "ep-mvp-11112222.eu-west-2.aws.neon.tech",
        projectId: PROJECT,
        branchId: "br-rehearsal",
        branchName: "rehearsal-2026-11-21",
        // Neither URL said anything about TLS: both ask for it.
        // The port is written out, so a driver takes it from nowhere else.
        targetUrl: `postgresql://app:pw@${REHEARSAL_HOST}:5432/eleva?sslmode=require`,
        sourceUrl: `${MVP_REBUILT}?sslmode=require`,
      })
    }
    expect(d.prompt).not.toHaveBeenCalled()
  })

  it("refuses a pooled host on either side, and names the direct one to use", async () => {
    // A migration needs a session of its own; a pool gives each
    // transaction to whichever connection is free.
    const target = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            TARGET_DATABASE_URL: `postgresql://app:s3cret-pw@${REHEARSAL_POOLED}/eleva`,
          }),
        },
        deps()
      )
    )
    expect(target.code).toBe("TARGET_HOST_POOLED")
    expect(target.exitCode).toBe(2)
    expect(target.message).toContain(REHEARSAL_HOST)
    expect(target.message).not.toContain("s3cret-pw")

    const source = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "dry-run",
          env: env({
            MVP_DATABASE_URL:
              "postgresql://reader:s3cret-pw@ep-mvp-11112222-pooler.eu-west-2.aws.neon.tech/mvp",
          }),
        },
        deps()
      )
    )
    expect(source.code).toBe("SOURCE_HOST_POOLED")
    expect(source.message).not.toContain("s3cret-pw")
  })

  it("lets the allow-list name the pooled form of the direct host it approves", async () => {
    await expect(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({ MIGRATION_ALLOWED_TARGET_HOSTS: REHEARSAL_POOLED }),
        },
        deps()
      )
    ).resolves.toMatchObject({ host: REHEARSAL_HOST })
  })

  it("refuses the default branch, whatever the allowlist says", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            TARGET_DATABASE_URL: `postgresql://app:pw@${PRODUCTION_HOST}/eleva`,
            MIGRATION_ALLOWED_TARGET_HOSTS: `${REHEARSAL_HOST},${PRODUCTION_HOST}`,
          }),
        },
        deps()
      )
    )
    expect(err.code).toBe("DEFAULT_BRANCH_IN_BRANCH_MODE")
    expect(err.exitCode).toBe(2)
  })

  it("refuses an endpoint of another project", async () => {
    const foreign = "ep-staging-55556666.eu-central-1.aws.neon.tech"
    const unknown = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "dry-run",
          env: env({
            TARGET_DATABASE_URL: `postgresql://app:pw@${foreign}/eleva`,
            MIGRATION_ALLOWED_TARGET_HOSTS: foreign,
          }),
        },
        deps()
      )
    )
    expect(unknown.code).toBe("ENDPOINT_NOT_IN_PROJECT")
    // Even if a lookup were to return it, the project id has to match.
    const mismatched = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "dry-run", env: env() },
        deps({
          resolveEndpoint: forTarget({
            ...ENDPOINTS[REHEARSAL_HOST]!,
            projectId: "staging-project-999",
          }),
        })
      )
    )
    expect(mismatched.code).toBe("ENDPOINT_NOT_IN_PROJECT")
  })

  it("refuses a branch that is not on the allowlist", async () => {
    for (const allowlist of [
      undefined,
      "",
      "ep-other.eu-central-1.aws.neon.tech",
    ]) {
      const err = await refusal(
        assertMigrationTarget(
          {
            target: "branch",
            mode: "apply",
            env: env({ MIGRATION_ALLOWED_TARGET_HOSTS: allowlist }),
          },
          deps()
        )
      )
      expect(err.code).toBe("HOST_NOT_ALLOWED")
    }
  })

  it("refuses a read replica and a branch Neon does not describe", async () => {
    const replica = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: forTarget({
            ...ENDPOINTS[REHEARSAL_HOST]!,
            isReadWrite: false,
          }),
        })
      )
    )
    expect(replica.code).toBe("ENDPOINT_NOT_WRITABLE")
    const unknown = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: forTarget({
            ...ENDPOINTS[REHEARSAL_HOST]!,
            isDefaultBranch: undefined,
          } as unknown as NeonEndpointInfo),
        })
      )
    )
    expect(unknown.code).toBe("BRANCH_UNKNOWN")
  })
})

describe("the connection a run may use", () => {
  it.each([
    ["host", PRODUCTION_HOST],
    ["hostaddr", "203.0.113.7"],
    ["port", "6543"],
    ["options", "endpoint=ep-prod-z9y8x7w6"],
    ["target_session_attrs", "any"],
    ["application_name", "migration"],
  ])(
    "refuses a %s parameter that could move the connection",
    async (key, value) => {
      for (const variable of [
        "TARGET_DATABASE_URL",
        "MVP_DATABASE_URL",
      ] as const) {
        const base = env()[variable]!
        const d = deps()
        const err = await refusal(
          assertMigrationTarget(
            {
              target: "branch",
              mode: "apply",
              env: env({
                [variable]: `${base}?sslmode=require&${key}=${encodeURIComponent(value)}`,
              }),
            },
            d
          )
        )
        expect(err.code).toBe("URL_PARAMETER_NOT_ALLOWED")
        expect(err.message).toContain(variable)
        // Neither the name nor the value is echoed: an unencoded "?" in a
        // password would make part of it a "parameter".
        expect(err.message).not.toContain(value)
        expect(d.resolveEndpoint).not.toHaveBeenCalled()
      }
    }
  )

  it.each([
    `postgresql://app:pw@${REHEARSAL_HOST}:6543/eleva`,
    `postgresql://app:pw@${REHEARSAL_HOST},${PRODUCTION_HOST}/eleva`,
    `postgresql://app:pw@[2001:db8::1]/eleva`,
    `postgresql://app:pw@${REHEARSAL_HOST}/eleva#${PRODUCTION_HOST}`,
  ])("refuses %s", async (url) => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({ TARGET_DATABASE_URL: url }),
        },
        deps()
      )
    )
    expect(["TARGET_URL_INVALID", "TARGET_NOT_NEON"]).toContain(err.code)
  })

  it.each([
    "sslmode=disable",
    "sslmode=no-verify",
    "sslmode=prefer",
    "sslmode=require&sslmode=disable",
    "sslmode=disable&sslmode=require",
    "channel_binding=disable",
    "sslmode=REQUIRE",
  ])("refuses %s: the connection stays encrypted", async (query) => {
    for (const variable of [
      "TARGET_DATABASE_URL",
      "MVP_DATABASE_URL",
    ] as const) {
      const base = env()[variable]!.split("?")[0]
      const d = deps()
      const err = await refusal(
        assertMigrationTarget(
          {
            target: "branch",
            mode: "apply",
            env: env({ [variable]: `${base}?${query}` }),
          },
          d
        )
      )
      expect(err.code).toBe("URL_PARAMETER_VALUE_NOT_ALLOWED")
      expect(d.resolveEndpoint).not.toHaveBeenCalled()
    }
  })

  it.each([
    "endpoint=ep-prod-z9y8x7w6;s3cret",
    "project%3Dep-prod-z9y8x7w6%24pw",
  ])("refuses a password that names the endpoint (%s)", async (password) => {
    const d = deps()
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            TARGET_DATABASE_URL: `postgresql://app:${password}@${REHEARSAL_HOST}/eleva?sslmode=require`,
          }),
        },
        d
      )
    )
    expect(err.code).toBe("URL_PASSWORD_NAMES_ENDPOINT")
    expect(err.message).not.toContain("s3cret")
    expect(d.resolveEndpoint).not.toHaveBeenCalled()
  })

  it("refuses a stray percent sign in a password as a bad URL, not a crash", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            MVP_DATABASE_URL:
              "postgresql://reader:p%zzs3cret@mvp.example.com/mvp",
          }),
        },
        deps()
      )
    )
    expect(err.code).toBe("SOURCE_URL_INVALID")
    expect(err.message).not.toContain("s3cret")
  })

  it("names the source, not the target, when the MVP URL is malformed", async () => {
    for (const url of ["not a url", "https://example.com/db"]) {
      const err = await refusal(
        assertMigrationTarget(
          {
            target: "branch",
            mode: "apply",
            env: env({ MVP_DATABASE_URL: url }),
          },
          deps()
        )
      )
      expect(err.code).toBe("SOURCE_URL_INVALID")
      expect(err.message).toContain("MVP_DATABASE_URL")
    }
  })

  it("never prints a password that an unencoded character moved into the host or the query", async () => {
    for (const url of [
      `postgresql://app?s3cret-pw@${REHEARSAL_HOST}/eleva`,
      `postgresql://app:s3cret-pw#x@${REHEARSAL_HOST}/eleva`,
      `postgresql://s3cret-pw_host/eleva`,
    ]) {
      const err = await refusal(
        assertMigrationTarget(
          {
            target: "branch",
            mode: "apply",
            env: env({ TARGET_DATABASE_URL: url }),
          },
          deps()
        )
      )
      expect(err.message).not.toContain("s3cret-pw")
    }
  })

  it("hands back connection strings rebuilt from what it checked", async () => {
    const approved = await assertMigrationTarget(
      {
        target: "branch",
        mode: "apply",
        env: env({
          TARGET_DATABASE_URL: `postgres://app:p%40ss@${REHEARSAL_HOST.toUpperCase()}:5432/eleva?sslmode=require&channel_binding=require`,
        }),
      },
      deps({
        resolveEndpoint: async (host) => ENDPOINTS[host] ?? null,
      })
    )
    expect(approved.targetUrl).toBe(
      `postgresql://app:p%40ss@${REHEARSAL_HOST}:5432/eleva?sslmode=require&channel_binding=require`
    )
    expect(approved.sourceUrl).toBe(`${MVP_REBUILT}?sslmode=require`)
    // The host the driver will use is the host that was approved.
    expect(new URL(approved.targetUrl).hostname).toBe(approved.host)
  })

  it("refuses a source that is a database of the v3 project", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            MVP_DATABASE_URL: `postgresql://reader:pw@${PRODUCTION_HOST}/eleva`,
          }),
        },
        deps()
      )
    )
    expect(err.code).toBe("SOURCE_IN_TARGET_PROJECT")
  })

  it("refuses, with exit 2, when Neon cannot be asked", async () => {
    const err = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: async () => {
            throw new Error("Neon API answered 401 for /projects/x/endpoints")
          },
        })
      )
    )
    expect(err.code).toBe("NEON_LOOKUP_FAILED")
    expect(err.exitCode).toBe(2)
  })

  it("repeats a resolver's words only when the resolver wrote them to be shown", async () => {
    const worded = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: async () => {
            throw new NeonLookupError("Neon API answered 401 for /projects/x")
          },
        })
      )
    )
    expect(worded.message).toContain("Neon API answered 401")

    // What a runtime says about a bad header quotes the header, key and all.
    const runtime = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: async () => {
            throw new TypeError(
              'Headers.append: "Bearer napi_SECRETKEY" is an invalid header value.'
            )
          },
        })
      )
    )
    expect(runtime.code).toBe("NEON_LOOKUP_FAILED")
    expect(runtime.message).toContain("(TypeError)")
    expect(runtime.message).not.toContain("napi_SECRETKEY")

    // Even the class of an unknown error is shown only when it looks like one.
    const hostile = new Error("x")
    hostile.name = "postgresql://u:hunter2@h/db"
    const named = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env() },
        deps({
          resolveEndpoint: async () => {
            throw hostile
          },
        })
      )
    )
    expect(named.message).toContain("(unknown error)")
    expect(named.message).not.toContain("hunter2")
  })
})

describe("what is checked before Neon is even asked", () => {
  it.each([
    [{ TARGET_DATABASE_URL: undefined }, "TARGET_URL_MISSING"],
    [{ TARGET_DATABASE_URL: "  " }, "TARGET_URL_MISSING"],
    [{ TARGET_DATABASE_URL: "not a url" }, "TARGET_URL_INVALID"],
    [{ TARGET_DATABASE_URL: "https://example.com/db" }, "TARGET_URL_INVALID"],
    [
      { TARGET_DATABASE_URL: "postgresql://app:pw@db.internal.example/eleva" },
      "TARGET_NOT_NEON",
    ],
    [
      {
        TARGET_DATABASE_URL: "postgresql://app:pw@neon.tech.evil.example/eleva",
      },
      "TARGET_NOT_NEON",
    ],
    [{ MVP_DATABASE_URL: undefined }, "SOURCE_URL_MISSING"],
    [
      { MVP_DATABASE_URL: `postgresql://reader:pw@${REHEARSAL_HOST}/eleva` },
      "SOURCE_IS_TARGET",
    ],
    [
      { MVP_DATABASE_URL: `postgresql://reader:pw@${REHEARSAL_POOLED}/eleva` },
      "SOURCE_IS_TARGET",
    ],
    [{ NEON_PROJECT_ID: undefined }, "NEON_PROJECT_MISSING"],
  ] as const)("refuses %j", async (overrides, code) => {
    const d = deps()
    const err = await refusal(
      assertMigrationTarget(
        { target: "branch", mode: "apply", env: env(overrides) },
        d
      )
    )
    expect(err.code).toBe(code)
    expect(d.resolveEndpoint).not.toHaveBeenCalled()
  })

  it("never puts a password in a refusal", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "apply",
          env: env({
            TARGET_DATABASE_URL:
              "postgresql://app:s3cret-pw@db.internal.example/eleva",
          }),
        },
        deps()
      )
    )
    expect(err.message).not.toContain("s3cret-pw")
  })
})

describe("cutover (--target production)", () => {
  it("accepts the default branch with today's date and the typed project id", async () => {
    const d = deps()
    await expect(
      assertMigrationTarget(
        { target: "production", mode: "apply", env: production() },
        d
      )
    ).resolves.toMatchObject({
      kind: "production",
      host: PRODUCTION_HOST,
      branchName: "main",
    })
    expect(d.prompt).toHaveBeenCalledTimes(1)
  })

  it("refuses when nobody is at the terminal", async () => {
    const d = deps({ isInteractive: () => false })
    const err = await refusal(
      assertMigrationTarget(
        { target: "production", mode: "apply", env: production() },
        d
      )
    )
    expect(err.code).toBe("PRODUCTION_NOT_INTERACTIVE")
    expect(d.prompt).not.toHaveBeenCalled()
  })

  it("refuses a rehearsal branch", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "production",
          mode: "apply",
          env: env({ MIGRATION_CONFIRM_PRODUCTION: "2026-11-21" }),
        },
        deps()
      )
    )
    expect(err.code).toBe("NOT_DEFAULT_BRANCH")
  })

  it.each([undefined, "", "2026-11-20", "2026-11-22", "21-11-2026", "yes"])(
    "refuses when MIGRATION_CONFIRM_PRODUCTION is %j",
    async (confirm) => {
      const d = deps()
      const err = await refusal(
        assertMigrationTarget(
          {
            target: "production",
            mode: "apply",
            env: production({ MIGRATION_CONFIRM_PRODUCTION: confirm }),
          },
          d
        )
      )
      expect(err.code).toBe("PRODUCTION_NOT_CONFIRMED")
      // The operator is not even asked.
      expect(d.prompt).not.toHaveBeenCalled()
    }
  )

  it("uses the UTC date, also late in the Lisbon evening", () => {
    expect(utcDate(new Date("2026-06-30T23:30:00+01:00"))).toBe("2026-06-30")
    expect(utcDate(new Date("2026-07-01T00:30:00+01:00"))).toBe("2026-06-30")
  })

  it.each(["", "production", "aged-wildflower-12345", `${PROJECT}x`])(
    "refuses when the operator types %j",
    async (typed) => {
      const err = await refusal(
        assertMigrationTarget(
          { target: "production", mode: "apply", env: production() },
          deps({ prompt: async () => typed })
        )
      )
      expect(err.code).toBe("PROJECT_ID_NOT_TYPED")
    }
  )

  it("asks for the same confirmation on a dry run", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "production",
          mode: "dry-run",
          env: production({ MIGRATION_CONFIRM_PRODUCTION: undefined }),
        },
        deps()
      )
    )
    expect(err.code).toBe("PRODUCTION_NOT_CONFIRMED")
  })
})

describe("what a driver could take from somewhere else", () => {
  it("refuses a run with a PG variable set, and shows its name only", async () => {
    const err = await refusal(
      assertMigrationTarget(
        {
          target: "branch",
          mode: "dry-run",
          env: {
            ...env(),
            PGPORT: "6543",
            PGOPTIONS: "-c default_transaction_read_only=off",
            PGPASSWORD: "s3cret-pw",
            // Set and empty is not set.
            PGHOST: "",
          } as MigrationGuardEnv,
        },
        deps()
      )
    )
    expect(err.code).toBe("PG_VARIABLES_SET")
    expect(err.exitCode).toBe(2)
    expect(err.message).toContain("PGOPTIONS, PGPASSWORD, PGPORT")
    expect(err.message).not.toContain("PGHOST")
    expect(err.message).not.toContain("6543")
    expect(err.message).not.toContain("s3cret-pw")
    expect(err.message).not.toContain("read_only")
  })

  it("refuses a URL with a second @, without showing any piece of it", async () => {
    // An unencoded "@" and "/" in the password shift the parse: a piece of
    // the password would be read as the host.
    for (const [name, url, code] of [
      [
        "TARGET_DATABASE_URL",
        `postgresql://app:t4rget@pa55frag/tail@${REHEARSAL_HOST}`,
        "TARGET_URL_INVALID",
      ],
      [
        "MVP_DATABASE_URL",
        "postgresql://reader:s0urce@pa55frag/tail@ep-mvp-11112222.eu-west-2.aws.neon.tech",
        "SOURCE_URL_INVALID",
      ],
    ] as const) {
      const err = await refusal(
        assertMigrationTarget(
          { target: "branch", mode: "dry-run", env: env({ [name]: url }) },
          deps()
        )
      )
      expect(err.code).toBe(code)
      expect(err.message).not.toContain("pa55frag")
      expect(err.message).not.toContain("t4rget")
      expect(err.message).not.toContain("s0urce")
    }
  })
})
