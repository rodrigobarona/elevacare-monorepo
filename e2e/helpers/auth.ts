import { neon } from "@neondatabase/serverless"
import {
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test"
import {
  e2eAuthUrlKey,
  hashedVerificationIdentifier,
  type E2eAuthLinkKind,
} from "@eleva/auth/e2e-auth-url"

export const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3002"
export const accountUrl = process.env.E2E_ACCOUNT_URL ?? "http://localhost:3006"
export const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:3007"

export const ACCOUNT_ORIGIN = accountUrl.replace(/\/$/, "")

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`
}

export const E2E_PASSWORD = "ElevaE2e!pass1"
export const E2E_PASSWORD_NEXT = "ElevaE2e!pass2"
export const E2E_PASSWORD_WRONG = "Definitely-Wrong-Pass1"

export type { E2eAuthLinkKind }

export function authHeaders(cookie?: string): Record<string, string> {
  return {
    Origin: ACCOUNT_ORIGIN,
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
  }
}

export function sessionCookie(response: APIResponse): string | null {
  const raw = response.headersArray()
  const parts: string[] = []
  for (const header of raw) {
    if (header.name.toLowerCase() !== "set-cookie") continue
    const pair = header.value.split(";", 1)[0]?.trim()
    if (pair) parts.push(pair)
  }
  return parts.length > 0 ? parts.join("; ") : null
}

export function tokenFromAuthUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const fromQuery = parsed.searchParams.get("token")
    if (fromQuery) return fromQuery
    const fromPath = parsed.pathname.match(
      /\/(?:reset-password|verify-email|magic-link)\/([^/]+)$/
    )
    return fromPath?.[1] ?? null
  } catch {
    return null
  }
}

export async function signUpEmail(
  request: APIRequestContext,
  input: { name: string; email: string; password: string }
): Promise<APIResponse> {
  return request.post(`${apiUrl}/auth/sign-up/email`, {
    headers: authHeaders(),
    data: input,
  })
}

export async function signInEmail(
  request: APIRequestContext,
  input: { email: string; password: string }
): Promise<APIResponse> {
  return request.post(`${apiUrl}/auth/sign-in/email`, {
    headers: authHeaders(),
    data: input,
  })
}

async function redisGet(key: string): Promise<string | null> {
  const restUrl = process.env.KV_REST_API_URL
  const restToken = process.env.KV_REST_API_TOKEN
  if (!restUrl || !restToken) return null
  const response = await fetch(`${restUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${restToken}` },
  })
  if (!response.ok) return null
  const body = (await response.json()) as { result?: unknown }
  return typeof body.result === "string" && body.result.length > 0
    ? body.result
    : null
}

export async function waitForE2eAuthUrl(
  kind: E2eAuthLinkKind,
  email: string,
  timeoutMs = 8_000
): Promise<string | null> {
  const key = e2eAuthUrlKey(kind, email)
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const url = await redisGet(key)
    if (url) return url
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}

function e2eDatabaseUrl(): string | null {
  if (process.env.VERCEL_ENV === "production") return null
  if (process.env.NODE_ENV === "production") return null
  return process.env.DATABASE_URL ?? null
}

async function tokenFromDatabase(email: string): Promise<string | null> {
  const databaseUrl = e2eDatabaseUrl()
  if (!databaseUrl) return null
  const plain = email
  const prefixed = `email-verification:${email}`
  const hashedPlain = hashedVerificationIdentifier(plain)
  const hashedPrefixed = hashedVerificationIdentifier(prefixed)
  const sql = neon(databaseUrl)
  const rows = await sql`
    SELECT value
    FROM auth.verification
    WHERE identifier IN (${plain}, ${prefixed}, ${hashedPlain}, ${hashedPrefixed})
      AND expires_at > now()
    ORDER BY created_at DESC NULLS LAST, expires_at DESC
    LIMIT 1
  `
  const value = rows[0]?.value
  return typeof value === "string" && value.length > 0 ? value : null
}

async function markEmailVerifiedInDatabase(email: string): Promise<boolean> {
  if (process.env.E2E_ALLOW_DB_WRITES !== "1") return false
  const databaseUrl = e2eDatabaseUrl()
  if (!databaseUrl) return false
  const sql = neon(databaseUrl)
  const rows = await sql`
    UPDATE auth."user"
    SET email_verified = true, updated_at = now()
    WHERE email = ${email}
    RETURNING id
  `
  return rows.length > 0
}

export async function verifyEmail(
  request: APIRequestContext,
  email: string
): Promise<void> {
  const bypass = process.env.E2E_AUTH_BYPASS_TOKEN
  if (bypass) {
    const verified = await request.post(`${apiUrl}/auth/e2e/verify-email`, {
      headers: authHeaders(),
      data: { email, token: bypass },
    })
    if (verified.status() === 200) return
  }

  const captured = await waitForE2eAuthUrl("verify-email", email)
  const capturedToken = captured ? tokenFromAuthUrl(captured) : null
  const token = capturedToken ?? (await tokenFromDatabase(email))
  if (token) {
    const verified = await request.get(
      `${apiUrl}/auth/verify-email?token=${encodeURIComponent(token)}`,
      { headers: { Origin: ACCOUNT_ORIGIN }, maxRedirects: 0 }
    )
    expect([200, 302]).toContain(verified.status())
    return
  }

  const marked = await markEmailVerifiedInDatabase(email)
  expect(
    marked,
    "verification token missing (restart pnpm dev so auth emails persist, or set DATABASE_URL)"
  ).toBeTruthy()
}

export async function getSession(
  request: APIRequestContext,
  cookie: string,
  options?: { disableCookieCache?: boolean }
): Promise<APIResponse> {
  const query = options?.disableCookieCache ? "?disableCookieCache=true" : ""
  return request.get(`${apiUrl}/auth/get-session${query}`, {
    headers: authHeaders(cookie),
  })
}
