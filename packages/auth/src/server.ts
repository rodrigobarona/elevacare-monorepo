import { cache } from "react"
import { cookies, headers } from "next/headers"
import { createApiClient, ApiClientError } from "@eleva/api-client"
import { cookieName, normalizeLocale, type Locale } from "@eleva/config/i18n"
import { UnauthorizedError, type ElevaSession } from "./types"
import { loadElevaSession } from "./load-eleva-session"
import {
  listAuthOrganizations,
  type UserOrganizationItem,
} from "./organizations"
import { hasDuplicateSessionCookie } from "./server/credentials"

export interface AuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const SESSION_FETCH_TIMEOUT_MS = 8_000

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:3002"
  )
}

function isAbortOrTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  )
}

const loadBetterAuthPayload = cache(async () => {
  const hdrs = await headers()
  const cookie = hdrs.get("cookie") ?? ""
  if (hasDuplicateSessionCookie(cookie)) return null
  const client = createApiClient({
    baseUrl: apiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
    signal: AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS),
  })
  try {
    return await client.auth.getSession()
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.status === 401 || err.status === 403) {
        return null
      }
    }
    if (isAbortOrTimeout(err)) return null
    throw err
  }
})

/**
 * Locale for authenticated surfaces. Cookie is the cross-app SSOT
 * (`ELEVA_LOCALE` on `.eleva.care`).
 */
export const getAuthenticatedLocale = cache(
  async (): Promise<Locale | null> => {
    const session = await getSession()
    if (!session) return null
    const jar = await cookies()
    return normalizeLocale(jar.get(cookieName)?.value)
  }
)

/**
 * Kept as a no-op after identity moved off JWT entitlement claims.
 * Callers still invoke this after Stripe mutations; Better Auth
 * sessions do not cache those claims.
 */
export async function refreshSessionEntitlements(): Promise<void> {
  return
}

/**
 * Default session loader (no org preference). Picks the first active
 * membership. Use `getSessionForOrg` in org-scoped layouts instead.
 */
export const getSession = cache(async (): Promise<ElevaSession | null> => {
  const payload = await loadBetterAuthPayload()
  if (!payload?.user) return null
  return loadElevaSession({
    userId: payload.user.id,
    email: payload.user.email,
    name: payload.user.name ?? null,
    image: payload.user.image ?? null,
    orgId: payload.session?.activeOrganizationId ?? null,
  })
})

/**
 * Org-aware session loader. Resolves the session using the org slug
 * from URL params so multi-org users land in the correct org context.
 *
 * Call this from `[orgSlug]/layout.tsx` instead of `getSession()`.
 * The Better Auth payload is request-cached; org selection is per slug.
 */
export async function getSessionForOrg(
  orgSlug: string
): Promise<ElevaSession | null> {
  const payload = await loadBetterAuthPayload()
  if (!payload?.user) return null
  return loadElevaSession({
    userId: payload.user.id,
    email: payload.user.email,
    name: payload.user.name ?? null,
    image: payload.user.image ?? null,
    orgId: payload.session?.activeOrganizationId ?? null,
    preferredOrgSlug: orgSlug,
  })
}

/**
 * Auth check for lightweight UI surfaces like the marketing header.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const payload = await loadBetterAuthPayload()
  if (!payload?.user) return null
  const parts = (payload.user.name ?? "").trim().split(/\s+/)

  return {
    id: payload.user.id,
    email: payload.user.email,
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(" ") || null,
    avatarUrl: payload.user.image ?? null,
  }
})

/**
 * Convenience wrapper that throws UnauthorizedError if there is no
 * session or the requested capability is missing. Use in Server
 * Actions / Route Handlers where unauthed access is a hard error.
 */
export async function requireSession(
  capability?: string
): Promise<ElevaSession> {
  const session = await getSession()
  if (!session) throw new UnauthorizedError("no-session")
  if (capability && !session.capabilities.includes(capability)) {
    throw new UnauthorizedError("missing-capability", `missing: ${capability}`)
  }
  return session
}

export async function requireOrg(): Promise<ElevaSession> {
  const session = await requireSession()
  if (!session.orgId) {
    throw new UnauthorizedError("no-session", "active organization required")
  }
  return session
}

export function getCapabilities(
  session: ElevaSession
): ElevaSession["capabilities"] {
  return session.capabilities
}

export interface UserOrganization extends UserOrganizationItem {}

/**
 * Fetch all organizations the current user belongs to.
 */
export async function getUserOrganizations(): Promise<UserOrganization[]> {
  const session = await requireSession()
  return listAuthOrganizations(session.user.id, session.orgId)
}
