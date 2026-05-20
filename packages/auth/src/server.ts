import { cache } from "react"
import { cookies, headers } from "next/headers"
import { eq, isNull } from "drizzle-orm"
import { WorkOS } from "@workos-inc/node"
import { normalizeWorkOSLocale, type Locale } from "@eleva/config/i18n"
import {
  refreshSession as authkitRefreshSession,
  withAuth as authkitGetSession,
} from "@workos-inc/authkit-nextjs"
import { unsealData } from "iron-session"
import { db, main } from "@eleva/db"
import { resolveSessionFromWorkosUser } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

export interface AuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

interface WorkosCookieSession {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email?: string
    firstName?: string | null
    lastName?: string | null
    locale?: string | null
  }
  impersonator?: unknown
}

/**
 * Read the WorkOS session directly from the cookie, bypassing the
 * middleware-header check that `withAuth()` enforces. Used as a
 * fallback when the proxy-injected `x-workos-middleware` request
 * header is not propagated to `headers()` (e.g. in Next.js 16 Route
 * Handlers).
 *
 * Returns the user PLUS the access token so callers can decode JWT
 * claims (permissions, entitlements, org_id) without a second cookie
 * unseal.
 */
async function getWorkosSessionFromCookie(): Promise<WorkosCookieSession | null> {
  const password = process.env.WORKOS_COOKIE_PASSWORD
  if (!password) return null

  const cookieStore = await cookies()
  const cookieName = process.env.WORKOS_COOKIE_NAME || "wos-session"
  const cookie = cookieStore.get(cookieName)
  if (!cookie) return null

  try {
    return await unsealData<WorkosCookieSession>(cookie.value, { password })
  } catch {
    return null
  }
}

async function getWorkosUserFromCookie(): Promise<
  WorkosCookieSession["user"] | null
> {
  const session = await getWorkosSessionFromCookie()
  return session?.user ?? null
}

/**
 * Server-side session loader. Tries AuthKit's header-based
 * `withAuth()` first (populated by the proxy via `authkit(req)`).
 * Falls back to direct cookie reading when the `x-workos-middleware`
 * request header is not forwarded — this happens in Next.js 16 Route
 * Handlers where `proxy.ts` sets the header via
 * `NextResponse.next({ request: { headers } })` but the runtime does
 * not propagate it to `headers()`.
 *
 * The cookie fallback only reads — no token refresh, no API call, no
 * cookie mutation — so it is safe in any server context.
 *
 * Memoised per-request via React.cache.
 */
interface ResolvedIdentity {
  workosUserId: string | null
  tokenEmail: string | null
  tokenFirstName: string | null
  tokenLastName: string | null
  permissions: string[]
  entitlements: string[]
  jwtOrgId: string | null
  tokenLocale: Locale | null
}

/**
 * Decode the payload section of a JWT without verification (the token
 * is already verified by AuthKit middleware or cookie unsealing).
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".")
  if (parts.length !== 3) return {}
  try {
    const payload = Buffer.from(parts[1]!, "base64url").toString("utf8")
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Shared helper that resolves WorkOS identity from AuthKit headers or
 * cookie fallback. Returns the raw token fields needed by
 * resolveSessionFromWorkosUser, plus JWT claims (permissions, entitlements).
 */
async function resolveWorkosIdentity(): Promise<ResolvedIdentity> {
  void headers()
  void cookies()

  try {
    const workosSession = await authkitGetSession()
    let permissions: string[] = []
    let entitlements: string[] = []
    let jwtOrgId: string | null = null

    if (workosSession.accessToken) {
      const claims = decodeJwtPayload(workosSession.accessToken)
      if (Array.isArray(claims.permissions)) {
        permissions = claims.permissions as string[]
      }
      if (Array.isArray(claims.entitlements)) {
        entitlements = claims.entitlements as string[]
      }
      if (typeof claims.org_id === "string") {
        jwtOrgId = claims.org_id
      }
    }

    return {
      workosUserId: workosSession.user?.id ?? null,
      tokenEmail: workosSession.user?.email ?? null,
      tokenFirstName: workosSession.user?.firstName ?? null,
      tokenLastName: workosSession.user?.lastName ?? null,
      permissions,
      entitlements,
      jwtOrgId,
      tokenLocale: normalizeWorkOSLocale(
        (workosSession.user as { locale?: unknown } | undefined)?.locale
      ),
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("AuthKit middleware")) {
      const cookieSession = await getWorkosSessionFromCookie()
      const cookieUser = cookieSession?.user ?? null

      // W6: decode JWT entitlements/permissions/org_id from the cookie
      // accessToken so capabilities and entitlements aren't blank during
      // the AuthKit-middleware-missing window.
      let permissions: string[] = []
      let entitlements: string[] = []
      let jwtOrgId: string | null = null
      if (cookieSession?.accessToken) {
        const claims = decodeJwtPayload(cookieSession.accessToken)
        if (Array.isArray(claims.permissions)) {
          permissions = claims.permissions as string[]
        }
        if (Array.isArray(claims.entitlements)) {
          entitlements = claims.entitlements as string[]
        }
        if (typeof claims.org_id === "string") {
          jwtOrgId = claims.org_id
        }
      }

      return {
        workosUserId: cookieUser?.id ?? null,
        tokenEmail: cookieUser?.email ?? null,
        tokenFirstName: cookieUser?.firstName ?? null,
        tokenLastName: cookieUser?.lastName ?? null,
        permissions,
        entitlements,
        jwtOrgId,
        tokenLocale: normalizeWorkOSLocale(cookieUser?.locale),
      }
    }
    throw err
  }
}

function getUserLocale(user: unknown): Locale | null {
  return normalizeWorkOSLocale((user as { locale?: unknown } | null)?.locale)
}

/**
 * WorkOS user.locale is the authenticated source of truth for UI language.
 *
 * AuthKit session payloads can include the user locale. If it is absent,
 * fetch the WorkOS user once per request and normalize any region-specific
 * value into Eleva's launch locale set.
 */
export const getAuthenticatedWorkOSLocale = cache(
  async (): Promise<Locale | null> => {
    const { workosUserId, tokenLocale } = await resolveWorkosIdentity()
    if (!workosUserId) return null
    if (tokenLocale) return tokenLocale

    try {
      const user = await getWorkOS().userManagement.getUser(workosUserId)
      return getUserLocale(user)
    } catch (err) {
      console.error(
        `[getAuthenticatedWorkOSLocale] failed to load WorkOS user locale: ${err instanceof Error ? err.message : String(err)}`
      )
      return null
    }
  }
)

/**
 * Force a WorkOS session refresh so the next page render picks up fresh
 * JWT claims (locale, entitlements, org_id, permissions). Use after a
 * server action mutates WorkOS user state that is reflected in the JWT.
 *
 * Wraps `refreshSession` from `@workos-inc/authkit-nextjs`. Non-throwing
 * by design: on failure the caller logs and returns; the user simply
 * sees stale claims until the next natural refresh.
 */
export async function refreshWorkOSSession(): Promise<void> {
  try {
    await authkitRefreshSession({ ensureSignedIn: false })
  } catch (err) {
    // Swallow — callers expect non-throwing semantics so they can fire-and-forget
    // without wrapping every call site. On failure the user sees stale JWT claims
    // until natural token rotation.
    console.error(
      `[refreshWorkOSSession] authkitRefreshSession failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Refresh the WorkOS session after entitlement-changing mutations (e.g.
 * Stripe subscription updates) so new entitlements appear immediately.
 *
 * Per ADR-016: the multi-admin attribution chain works regardless of
 * whether refresh succeeded (we audit the action that triggered the
 * refresh, not the refresh itself).
 */
export async function refreshSessionEntitlements(): Promise<void> {
  return refreshWorkOSSession()
}

/**
 * Default session loader (no org preference). Picks the first active
 * membership. Use `getSessionForOrg` in org-scoped layouts instead.
 */
export const getSession = cache(async (): Promise<ElevaSession | null> => {
  const {
    workosUserId,
    tokenEmail,
    tokenFirstName,
    tokenLastName,
    permissions,
    entitlements,
    jwtOrgId,
  } = await resolveWorkosIdentity()
  if (!workosUserId) return null
  return resolveSessionFromWorkosUser(
    workosUserId,
    {
      email: tokenEmail ?? "unknown",
      firstName: tokenFirstName,
      lastName: tokenLastName,
    },
    { jwtPermissions: permissions, jwtEntitlements: entitlements, jwtOrgId }
  )
})

/**
 * Org-aware session loader. Resolves the session using the org slug
 * from URL params so multi-org users land in the correct org context.
 *
 * Call this from `[orgSlug]/layout.tsx` instead of `getSession()`.
 * NOT cache()'d because the orgSlug varies per-layout invocation.
 */
export async function getSessionForOrg(
  orgSlug: string
): Promise<ElevaSession | null> {
  const {
    workosUserId,
    tokenEmail,
    tokenFirstName,
    tokenLastName,
    permissions,
    entitlements,
    jwtOrgId,
  } = await resolveWorkosIdentity()
  if (!workosUserId) return null
  return resolveSessionFromWorkosUser(
    workosUserId,
    {
      email: tokenEmail ?? "unknown",
      firstName: tokenFirstName,
      lastName: tokenLastName,
    },
    {
      preferredOrgSlug: orgSlug,
      jwtPermissions: permissions,
      jwtEntitlements: entitlements,
      jwtOrgId,
    }
  )
}

/**
 * Auth check for lightweight UI surfaces like the marketing header.
 * WorkOS remains the source for identity fields; the Eleva user row
 * provides app-owned profile state such as the uploaded avatar URL.
 *
 * Memoised per-request via React.cache.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const user = await resolveWorkosUserOrNull()
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? "unknown",
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: await getAvatarUrlForWorkosUser(user.id),
  }
})

async function getAvatarUrlForWorkosUser(
  workosUserId: string
): Promise<string | null> {
  const [row] = await db()
    .select({ avatarUrl: main.users.avatarUrl })
    .from(main.users)
    .where(eq(main.users.workosUserId, workosUserId))
    .limit(1)

  return row?.avatarUrl ?? null
}

async function resolveWorkosUserOrNull(): Promise<
  WorkosCookieSession["user"] | null
> {
  try {
    const workosSession = await authkitGetSession()
    return workosSession.user ?? null
  } catch (err) {
    if (err instanceof Error && err.message.includes("AuthKit middleware")) {
      return await getWorkosUserFromCookie()
    }
    throw err
  }
}

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

let _workos: WorkOS | null = null

/**
 * Singleton WorkOS SDK client. Reads WORKOS_API_KEY and WORKOS_CLIENT_ID
 * from the environment. The clientId is required so that widget tokens are
 * bound to the correct application (and its allowed-origins CORS list).
 *
 * Exported so that other packages (e.g. the QStash sync route) can reuse
 * the same instance without duplicating env-var handling.
 */
export function getWorkOS(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required")
    const clientId = process.env.WORKOS_CLIENT_ID
    if (!clientId) throw new Error("WORKOS_CLIENT_ID is required")
    _workos = new WorkOS(key, { clientId })
  }
  return _workos
}

/**
 * Generate a WorkOS widget token for the given user + organization.
 * Used by the Pipes connection widget on the integrations/calendars pages.
 *
 * Prefer `getWidgetTokenFromSession()` in most cases to avoid trusting
 * caller-supplied IDs.
 */
export async function getWidgetToken(
  userId: string,
  organizationId: string,
  scopes?: string[]
): Promise<string> {
  if (!userId || !organizationId) {
    throw new Error("getWidgetToken: userId and organizationId are required")
  }
  const workos = getWorkOS()
  const response = await workos.widgets.createToken({
    userId,
    organizationId,
    ...(scopes?.length && { scopes }),
  } as Parameters<typeof workos.widgets.createToken>[0])
  return response.token
}

/**
 * Session-aware variant that derives userId and organizationId from
 * the authenticated session. Throws UnauthorizedError if there is no
 * active session.
 */
export async function getWidgetTokenFromSession(
  scopes?: string[]
): Promise<string> {
  const session = await requireSession()
  return getWidgetToken(session.user.workosUserId, session.workosOrgId, scopes)
}

export interface UserOrganization {
  workosOrgId: string
  orgId: string
  orgSlug: string | null
  orgType: string
  name: string
  isCurrent: boolean
}

/**
 * Fetch all organizations the current user belongs to, enriched with
 * display names from WorkOS. Runs server-side only (no CORS issues).
 *
 * Falls back to a formatted slug when the WorkOS API call fails.
 */
export async function getUserOrganizations(): Promise<UserOrganization[]> {
  const session = await requireSession()
  const workos = getWorkOS()

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: session.user.workosUserId,
    statuses: ["active"],
  })

  const orgs = await Promise.all(
    memberships.data.map(async (m) => {
      let name: string
      try {
        const org = await workos.organizations.getOrganization(m.organizationId)
        name = org.name
      } catch {
        name = formatSlugAsName(m.organizationId)
      }

      return {
        workosOrgId: m.organizationId,
        orgId: "",
        orgSlug: null as string | null,
        orgType: "",
        name,
        isCurrent: m.organizationId === session.workosOrgId,
      }
    })
  )

  const orgIdRows = await db()
    .select({
      id: main.organizations.id,
      workosOrgId: main.organizations.workosOrgId,
      slug: main.organizations.slug,
      type: main.organizations.type,
    })
    .from(main.organizations)
    .where(isNull(main.organizations.deletedAt))

  const byWorkosId = new Map(orgIdRows.map((r) => [r.workosOrgId, r]))
  for (const org of orgs) {
    const row = byWorkosId.get(org.workosOrgId)
    if (row) {
      org.orgId = row.id
      org.orgSlug = row.slug
      org.orgType = row.type
    }
  }

  return orgs.filter((o) => o.orgId && o.orgSlug)
}

function formatSlugAsName(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
