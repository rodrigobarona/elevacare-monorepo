import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { drizzle } from "drizzle-orm/node-postgres"
import * as OTPAuth from "otpauth"
import { BETTER_AUTH_VERSION, pool } from "./auth.ts"
import { lastEmail } from "./inbox.ts"
import { startSpikeServer } from "./server.ts"

async function wipeSpikeData(): Promise<void> {
  await pool.query(`
    truncate table
      "session",
      "account",
      "member",
      "invitation",
      "organization",
      "verification",
      "twoFactor",
      "passkey",
      "apikey",
      "jwks",
      "user"
    restart identity cascade
  `)
}

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SPIKE_PORT ?? "8787")
const BASE = process.env.BETTER_AUTH_URL ?? `http://127.0.0.1:${PORT}`
const PASSWORD = "Spike-pass-1!"
const stamp = Date.now()
const email = `spike.${stamp}@example.com`
const name = "Rodrigo Spike"

type Evidence = {
  id: string
  title: string
  status: "proven" | "plan-change"
  version: string
  request: Record<string, unknown>
  response: Record<string, unknown>
  notes: string[]
}

const evidence: Evidence[] = []

function redact(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  if (value.length <= 12) return `${value.slice(0, 4)}…`
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function redactTokenField(value: unknown): unknown {
  if (!value || typeof value !== "object") return value
  const body = value as { token?: string }
  return { ...body, token: redact(body.token) }
}

class CookieJar {
  private readonly values = new Map<string, string>()
  lastSetCookie: string[] = []
  allSetCookie: string[] = []

  apply(headers: Headers): void {
    const setCookie =
      typeof headers.getSetCookie === "function" ? headers.getSetCookie() : []
    this.lastSetCookie = setCookie
    this.allSetCookie.push(...setCookie)
    for (const header of setCookie) {
      const [pair] = header.split(";")
      const eq = pair.indexOf("=")
      if (eq === -1) continue
      const key = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      if (header.toLowerCase().includes("max-age=0") || value === "") {
        this.values.delete(key)
      } else {
        this.values.set(key, value)
      }
    }
  }

  header(): string | undefined {
    if (this.values.size === 0) return undefined
    return [...this.values.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ")
  }

  sessionToken(): string | undefined {
    for (const [key, value] of this.values) {
      if (key.includes("session_token")) return value
    }
    return undefined
  }

  clone(): CookieJar {
    const next = new CookieJar()
    for (const [key, value] of this.values) next.values.set(key, value)
    return next
  }
}

async function call(
  method: string,
  pathname: string,
  options: {
    jar?: CookieJar
    body?: unknown
    headers?: Record<string, string>
    bearer?: string
  } = {}
): Promise<{ status: number; json: unknown; headers: Headers; text: string }> {
  const headers = new Headers(options.headers)
  if (!headers.has("origin")) {
    headers.set("origin", BASE)
  }
  if (options.body !== undefined) {
    headers.set("content-type", "application/json")
  }
  const cookie = options.jar?.header()
  if (cookie) headers.set("cookie", cookie)
  if (options.bearer) headers.set("authorization", `Bearer ${options.bearer}`)

  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  options.jar?.apply(response.headers)
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  return { status: response.status, json, headers: response.headers, text }
}

function record(entry: Evidence): void {
  evidence.push(entry)
  console.log(
    `${entry.status === "proven" ? "OK" : "CHG"} ${entry.id} ${entry.title}`
  )
}

async function verifyJwtInChild(
  token: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(ROOT, "verify-jwt.ts"),
        token,
        `${BASE}/auth/jwks`,
      ],
      {
        cwd: path.join(ROOT, ".."),
        env: { ...process.env, BETTER_AUTH_URL: BASE },
      }
    )
    let stdout = ""
    let stderr = ""
    let settled = false
    const finish = (result: {
      code: number
      stdout: string
      stderr: string
    }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      finish({ code: 1, stdout, stderr: `${stderr}\nverify-jwt timed out` })
    }, 30_000)
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", (error: Error) => {
      finish({ code: 1, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.on("close", (code) => {
      finish({ code: code ?? 1, stdout, stderr })
    })
  })
}

const server = await startSpikeServer(PORT)
const jar = new CookieJar()

try {
  await wipeSpikeData()
  const ok = await call("GET", "/auth/ok")
  if (ok.status !== 200) throw new Error(`health ${ok.status}`)

  const signUp = await call("POST", "/auth/sign-up/email", {
    jar,
    body: { name, email, password: PASSWORD },
  })
  const verifyMail = lastEmail("verify")
  if (!verifyMail) {
    throw new Error(
      `no verification email captured (sign-up ${signUp.status}: ${JSON.stringify(signUp.json)})`
    )
  }
  const verify = await call(
    "GET",
    `/auth/verify-email?token=${encodeURIComponent(verifyMail.token)}&callbackURL=/`,
    { jar }
  )
  const sessionAfterVerify = await call("GET", "/auth/get-session", { jar })
  const sessionUser = (
    sessionAfterVerify.json as {
      user?: { id: string; email: string; emailVerified?: boolean }
    }
  )?.user
  const verifyProven =
    Boolean(sessionUser?.id) &&
    sessionUser?.email === email &&
    sessionUser?.emailVerified === true
  if (!verifyProven) {
    throw new Error(
      `verify incomplete: email=${sessionUser?.email} verified=${sessionUser?.emailVerified}`
    )
  }

  record({
    id: "01-signup-verify",
    title: "Sign-up + email verification",
    status: "proven",
    version: BETTER_AUTH_VERSION,
    request: {
      method: "POST",
      path: "/auth/sign-up/email",
      body: { name, email, password: "[redacted]" },
      verify: {
        method: "GET",
        path: "/auth/verify-email",
        token: redact(verifyMail.token),
      },
    },
    response: {
      signUpStatus: signUp.status,
      signUp: signUp.json,
      verifyStatus: verify.status,
      sessionStatus: sessionAfterVerify.status,
      userId: sessionUser.id,
      emailVerified: (
        sessionAfterVerify.json as { user?: { emailVerified?: boolean } }
      )?.user?.emailVerified,
    },
    notes: [
      "requireEmailVerification + sendOnSignUp captured the token in-process.",
      "autoSignInAfterVerification minted a session cookie.",
    ],
  })

  const orgs = await call("GET", "/auth/organization/list", { jar })
  const orgPayload = orgs.json
  const orgList = Array.isArray(orgPayload)
    ? (orgPayload as {
        id: string
        name: string
        type?: string
        slug?: string
      }[])
    : ((
        orgPayload as {
          organizations?: {
            id: string
            name: string
            type?: string
            slug?: string
          }[]
        }
      )?.organizations ?? [])
  const personal = orgList.find((org) => org.type === "personal") ?? orgList[0]
  record({
    id: "02-personal-space",
    title: "Personal Space provisioning hook",
    status: personal?.name?.endsWith("'s Space") ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      hook: "databaseHooks.user.create.after -> auth.api.createOrganization",
      expectedName: "Rodrigo's Space",
    },
    response: { listStatus: orgs.status, organizations: orgList },
    notes: [
      personal
        ? `Hook created ${personal.name} (${personal.slug ?? "no-slug"}) type=${personal.type}.`
        : "No personal organization appeared after user.create.after.",
      "withAudit is unproven here: the isolated auth_spike database has no audit_outbox. 02.1 wraps this hook in withAudit from @eleva/audit.",
    ],
  })

  const expert = await call("POST", "/auth/organization/create", {
    jar,
    body: {
      name: "Rodrigo Expert",
      slug: `expert-${stamp}`,
      type: "expert",
    },
  })
  const expertBody = expert.json as {
    id?: string
    type?: string
    name?: string
  }
  record({
    id: "03-expert-org",
    title: "Expert organization creation",
    status:
      expert.status < 300 && expertBody.type === "expert"
        ? "proven"
        : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      method: "POST",
      path: "/auth/organization/create",
      body: { name: "Rodrigo Expert", slug: `expert-${stamp}`, type: "expert" },
    },
    response: { status: expert.status, body: expert.json },
    notes: [
      "additionalFields.type=expert is first-class on createOrganization.",
    ],
  })

  const setActive = await call("POST", "/auth/organization/set-active", {
    jar,
    body: { organizationId: expertBody.id },
  })
  const sessionAfterSwitch = await call("GET", "/auth/get-session", { jar })
  const activeId = (
    sessionAfterSwitch.json as { session?: { activeOrganizationId?: string } }
  )?.session?.activeOrganizationId
  record({
    id: "04-org-switch",
    title: "Organization switching (active org on the session)",
    status: activeId === expertBody.id ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      method: "POST",
      path: "/auth/organization/set-active",
      body: { organizationId: redact(expertBody.id) },
    },
    response: {
      setActiveStatus: setActive.status,
      setActive: setActive.json,
      activeOrganizationId: activeId,
    },
    notes: ["session.activeOrganizationId updates after set-active."],
  })

  const domainHeader = jar.allSetCookie.find((header) =>
    /domain=/i.test(header)
  )
  const hasDevDomain = Boolean(
    domainHeader?.toLowerCase().includes("domain=.dev.eleva.care")
  )
  record({
    id: "05-cross-subdomain-cookie",
    title: "Cross-subdomain cookie on *.dev.eleva.care",
    status: hasDevDomain ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      option: "advanced.crossSubDomainCookies",
      domain: ".dev.eleva.care",
    },
    response: {
      setCookie: (domainHeader ?? jar.allSetCookie[0] ?? "").replace(
        /=([^;]+)/,
        (_match, captured: string) => `=${redact(captured) ?? "…"}`
      ),
    },
    notes: [
      "Header-level Domain=.dev.eleva.care is set. Live browser proof on a real *.dev.eleva.care host is Phase 2 staging, not this spike process.",
    ],
  })

  const apiKeyCreate = await call("POST", "/auth/api-key/create", {
    jar,
    body: { name: "spike-agent", metadata: { orgId: expertBody.id } },
  })
  const apiKeyBody = apiKeyCreate.json as { key?: string; id?: string }
  const apiKeyAuth = await call("GET", "/auth/get-session", {
    headers: { "x-api-key": apiKeyBody.key ?? "" },
  })
  record({
    id: "07-api-key",
    title: "API key create + authenticate",
    status:
      apiKeyCreate.status < 300 && apiKeyAuth.status === 200 && apiKeyBody.key
        ? "proven"
        : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      create: {
        method: "POST",
        path: "/auth/api-key/create",
        name: "spike-agent",
      },
      auth: { method: "GET", path: "/auth/get-session", header: "x-api-key" },
    },
    response: {
      createStatus: apiKeyCreate.status,
      keyId: apiKeyBody.id,
      key: redact(apiKeyBody.key),
      sessionStatus: apiKeyAuth.status,
      sessionUser: (apiKeyAuth.json as { user?: { id?: string } })?.user?.id,
    },
    notes: [
      "Key is returned once on create. x-api-key authenticates without a cookie.",
      "Import is @better-auth/api-key, not better-auth/plugins.",
    ],
  })

  const signInBearer = await call("POST", "/auth/sign-in/email", {
    body: { email, password: PASSWORD },
  })
  const opaque = (signInBearer.json as { token?: string })?.token
  const bearerAuth = await call("GET", "/auth/get-session", {
    bearer: opaque,
  })
  record({
    id: "08-opaque-bearer",
    title: "Opaque bearer session token",
    status:
      Boolean(opaque) && bearerAuth.status === 200 ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      signIn: { method: "POST", path: "/auth/sign-in/email" },
      auth: {
        method: "GET",
        path: "/auth/get-session",
        header: "Authorization: Bearer <session>",
      },
    },
    response: {
      signInStatus: signInBearer.status,
      token: redact(opaque),
      sessionStatus: bearerAuth.status,
      userId: (bearerAuth.json as { user?: { id?: string } })?.user?.id,
    },
    notes: [
      "bearer() plugin returns a session token on sign-in and accepts it as Authorization: Bearer.",
      "Shape is opaque (not three JWT segments).",
    ],
  })

  const jwtRes = await call("GET", "/auth/token", { jar })
  const jwtToken = (jwtRes.json as { token?: string })?.token
  const child = jwtToken
    ? await verifyJwtInChild(jwtToken)
    : { code: 1, stdout: "", stderr: "no token" }
  let childPayload: unknown = child.stdout
  try {
    childPayload = JSON.parse(child.stdout)
  } catch {
    childPayload = { stdout: child.stdout, stderr: child.stderr }
  }
  record({
    id: "09-jwt-jwks",
    title: "JWT + JWKS verification from a second process",
    status: child.code === 0 ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      token: { method: "GET", path: "/auth/token" },
      jwks: { method: "GET", path: "/auth/jwks" },
      verifier: "packages/auth/spikes/src/verify-jwt.ts (jose, child process)",
    },
    response: {
      tokenStatus: jwtRes.status,
      jwt: redact(jwtToken),
      childExit: child.code,
      child: childPayload,
    },
    notes: [
      "jwt plugin issues a compact JWS; jose in a child process verified it against /auth/jwks.",
    ],
  })

  await pool.query(`update "user" set role = 'platform_admin' where id = $1`, [
    sessionUser.id,
  ])
  const adminCheck = await call("POST", "/auth/admin/has-permission", {
    jar,
    body: { permissions: { user: ["list"] } },
  })
  const adminUsers = await call("GET", "/auth/admin/list-users?limit=5", {
    jar,
  })
  const adminPermitted =
    adminCheck.status === 200 &&
    (adminCheck.json as { success?: boolean })?.success === true
  record({
    id: "10-admin-role",
    title: "Admin role check",
    status:
      adminPermitted && adminUsers.status === 200 ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      promote: `UPDATE "user" SET role = 'platform_admin'`,
      list: { method: "GET", path: "/auth/admin/list-users" },
    },
    response: {
      hasPermissionStatus: adminCheck.status,
      hasPermission: adminCheck.json,
      listStatus: adminUsers.status,
      userCount: (adminUsers.json as { users?: unknown[] })?.users?.length,
    },
    notes: [
      "roles.platform_admin = adminAc from better-auth/plugins/admin/access; adminRoles: ['platform_admin'] is valid once that role exists.",
      "02.1 must also define staff_support and staff_finance and promote via auth.api.setRole.",
    ],
  })

  const googleStart = await call("POST", "/auth/sign-in/social", {
    body: { provider: "google", callbackURL: "/" },
  })
  record({
    id: "11-google-linking",
    title: "Google account linking by email",
    status: "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      method: "POST",
      path: "/auth/sign-in/social",
      body: { provider: "google" },
      config: {
        accountLinking: {
          enabled: true,
          disableImplicitLinking: true,
          trustedProviders: ["google"],
        },
      },
    },
    response: {
      status: googleStart.status,
      location: googleStart.headers.get("location"),
      body: googleStart.json,
    },
    notes: [
      "ADR-017 already forbids implicit same-email Google linking. A Google sign-in for an existing email must return account_not_linked unless the user called linkSocial() after a verified session.",
      "The phase file omitted disableImplicitLinking: true — absorb ADR-017 into PR 02.1 options.",
      "Live Google round-trip was not run (no real consent screen in this spike). Threat model: never link on unverified email match; disableImplicitLinking closes the account-takeover path.",
    ],
  })

  const second = await call("POST", "/auth/sign-in/email", {
    body: { email, password: PASSWORD },
  })
  const secondToken = (second.json as { token?: string })?.token
  const skippedAuth = {
    status: 0,
    json: null,
    headers: new Headers(),
    text: "",
  }
  const secondBefore =
    second.status === 200 && secondToken
      ? await call("GET", "/auth/get-session", { bearer: secondToken })
      : skippedAuth
  const secondWasAlive =
    secondBefore.status === 200 &&
    Boolean((secondBefore.json as { user?: { id?: string } })?.user?.id)

  const revoke = secondWasAlive
    ? await call("POST", "/auth/revoke-other-sessions", { jar })
    : skippedAuth
  const firstStill = secondWasAlive
    ? await call("GET", "/auth/get-session", { jar })
    : skippedAuth
  const secondStill =
    secondWasAlive && secondToken
      ? await call("GET", "/auth/get-session", { bearer: secondToken })
      : skippedAuth
  const secondAlive =
    secondStill.status === 200 &&
    Boolean((secondStill.json as { user?: { id?: string } })?.user?.id)
  const firstAlive =
    firstStill.status === 200 &&
    Boolean((firstStill.json as { user?: { id?: string } })?.user?.id)
  record({
    id: "12-session-revoke",
    title: "Session revocation propagating to every client",
    status:
      secondWasAlive && firstAlive && !secondAlive ? "proven" : "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      secondSignIn: { method: "POST", path: "/auth/sign-in/email" },
      revoke: { method: "POST", path: "/auth/revoke-other-sessions" },
    },
    response: {
      secondSignInStatus: second.status,
      secondTokenPresent: Boolean(secondToken),
      secondSessionBeforeRevoke: secondWasAlive,
      revokeStatus: revoke.status,
      currentCookieSessionAlive: firstAlive,
      otherBearerAlive: secondAlive,
      otherSession: secondStill.json,
    },
    notes: secondWasAlive
      ? [
          "revoke-other-sessions keeps the caller and drops the second token.",
          "cookieCache (300s) can keep a cached cookie view after DB revoke — 02.1 requireApiAuth must not treat cookieCache as a revocation source of truth for sign-out/revoke.",
        ]
      : [
          "Second sign-in or pre-revoke get-session failed; revocation not proven.",
        ],
  })

  const enable2fa = await call("POST", "/auth/two-factor/enable", {
    jar,
    body: { password: PASSWORD },
  })
  const twoFactorBody = enable2fa.json as {
    totpURI?: string
    backupCodes?: string[]
  }
  let totpVerified = false
  let totpError: unknown
  if (twoFactorBody.totpURI) {
    const totp = OTPAuth.URI.parse(twoFactorBody.totpURI)
    const code = totp.generate()
    const verifyTotp = await call("POST", "/auth/two-factor/verify-totp", {
      jar,
      body: { code },
    })
    totpVerified = verifyTotp.status < 300
    totpError = verifyTotp.json
  }
  const passkeyOptions = await call(
    "GET",
    "/auth/passkey/generate-register-options",
    { jar }
  )
  record({
    id: "06-passkey-totp",
    title: "Passkey + TOTP enrolment and verify",
    status: "plan-change",
    version: BETTER_AUTH_VERSION,
    request: {
      totp: {
        method: "POST",
        path: "/auth/two-factor/enable then /two-factor/verify-totp",
      },
      passkey: {
        method: "GET",
        path: "/auth/passkey/generate-register-options",
      },
    },
    response: {
      enableStatus: enable2fa.status,
      totpVerified,
      backupCodeCount: twoFactorBody.backupCodes?.length,
      passkeyStatus: passkeyOptions.status,
      passkey: passkeyOptions.json,
      totpVerify: redactTokenField(totpError),
    },
    notes: [
      totpVerified
        ? "TOTP secret came from totpURI and was verified with otpauth in-process."
        : "TOTP enrol/verify failed.",
      "Passkey attestation is unproven. Registration options returned; completing WebAuthn needs a browser authenticator (Playwright virtual authenticator in 02.2). This row is plan-change until attestation lands.",
    ],
  })

  let drizzleStatus: "proven" | "plan-change" = "plan-change"
  let drizzleNote = "drizzleAdapter construction failed"
  try {
    const adapter = drizzleAdapter(drizzle(pool), { provider: "pg" })
    drizzleStatus = typeof adapter === "function" ? "proven" : "plan-change"
    drizzleNote = `drizzleAdapter() returned ${typeof adapter}`
  } catch (error) {
    drizzleNote = error instanceof Error ? error.message : String(error)
  }
  record({
    id: "13-drizzle-adapter",
    title: "@better-auth/drizzle-adapter 1.7.3 constructs",
    status: drizzleStatus,
    version: BETTER_AUTH_VERSION,
    request: {
      import: "@better-auth/drizzle-adapter",
      call: 'drizzleAdapter(drizzle(pool), { provider: "pg" })',
    },
    response: { note: drizzleNote },
    notes: [
      "02.1 applies this adapter to the generated auth schema + drizzle-kit, not getMigrations (Kysely-only).",
    ],
  })
} finally {
  try {
    await writeFile(
      path.join(ROOT, "..", "evidence.json"),
      JSON.stringify(
        {
          version: BETTER_AUTH_VERSION,
          generatedAt: new Date().toISOString(),
          evidence,
        },
        null,
        2
      )
    )
  } finally {
    try {
      await wipeSpikeData()
    } finally {
      await Promise.allSettled([server.close(), pool.end()])
    }
  }
}

console.log(`wrote ${evidence.length} evidence rows`)
for (const row of evidence) {
  if (row.status === "plan-change") {
    console.log(`PLAN-CHANGE ${row.id}: ${row.notes.join(" ")}`)
  }
}
