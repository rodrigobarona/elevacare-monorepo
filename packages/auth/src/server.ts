import { cache } from "react"
import { cookies, headers } from "next/headers"
import { WorkOS } from "@workos-inc/node"
import { withAuth as authkitGetSession } from "@workos-inc/authkit-nextjs"
import { unsealData } from "iron-session"
import { resolveSessionFromWorkosUser } from "./session"
import { UnauthorizedError, type ElevaSession } from "./types"

export interface AuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

interface WorkosCookieSession {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email?: string
    firstName?: string | null
    lastName?: string | null
  }
  impersonator?: unknown
}

/**
 * Read the WorkOS session directly from the cookie, bypassing the
 * middleware-header check that `withAuth()` enforces. Used as a
 * fallback when the proxy-injected `x-workos-middleware` request
 * header is not propagated to `headers()` (e.g. in Next.js 16 Route
 * Handlers).
 */
async function getWorkosUserFromCookie(): Promise<
  WorkosCookieSession["user"] | null
> {
  const password = process.env.WORKOS_COOKIE_PASSWORD
  if (!password) return null

  const cookieStore = await cookies()
  const cookieName = process.env.WORKOS_COOKIE_NAME || "wos-session"
  const cookie = cookieStore.get(cookieName)
  if (!cookie) return null

  try {
    const session = await unsealData<WorkosCookieSession>(cookie.value, {
      password,
    })
    return session.user ?? null
  } catch {
    return null
  }
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
/**
 * Shared helper that resolves WorkOS identity from AuthKit headers or
 * cookie fallback. Returns the raw token fields needed by
 * resolveSessionFromWorkosUser.
 */
async function resolveWorkosIdentity() {
  void headers()
  void cookies()

  let workosUserId: string | null = null
  let tokenEmail: string | null = null
  let tokenFirstName: string | null = null
  let tokenLastName: string | null = null

  try {
    const workosSession = await authkitGetSession()
    workosUserId = workosSession.user?.id ?? null
    tokenEmail = workosSession.user?.email ?? null
    tokenFirstName = workosSession.user?.firstName ?? null
    tokenLastName = workosSession.user?.lastName ?? null
  } catch (err) {
    if (err instanceof Error && err.message.includes("AuthKit middleware")) {
      const cookieUser = await getWorkosUserFromCookie()
      workosUserId = cookieUser?.id ?? null
      tokenEmail = cookieUser?.email ?? null
      tokenFirstName = cookieUser?.firstName ?? null
      tokenLastName = cookieUser?.lastName ?? null
    } else {
      throw err
    }
  }

  return { workosUserId, tokenEmail, tokenFirstName, tokenLastName }
}

/**
 * Default session loader (no org preference). Picks the first active
 * membership. Use `getSessionForOrg` in org-scoped layouts instead.
 */
export const getSession = cache(async (): Promise<ElevaSession | null> => {
  const { workosUserId, tokenEmail, tokenFirstName, tokenLastName } =
    await resolveWorkosIdentity()
  if (!workosUserId) return null
  return resolveSessionFromWorkosUser(workosUserId, {
    email: tokenEmail ?? "unknown",
    firstName: tokenFirstName,
    lastName: tokenLastName,
  })
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
  const { workosUserId, tokenEmail, tokenFirstName, tokenLastName } =
    await resolveWorkosIdentity()
  if (!workosUserId) return null
  return resolveSessionFromWorkosUser(
    workosUserId,
    {
      email: tokenEmail ?? "unknown",
      firstName: tokenFirstName,
      lastName: tokenLastName,
    },
    { preferredOrgSlug: orgSlug }
  )
}

/**
 * Lightweight auth check that returns basic WorkOS user info from the
 * session cookie without querying the database. Ideal for UI that
 * only needs to know "is the user logged in?" and show their name
 * (e.g. the marketing site header avatar).
 *
 * Memoised per-request via React.cache.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  let user: WorkosCookieSession["user"] | null = null

  try {
    const workosSession = await authkitGetSession()
    user = workosSession.user ?? null
  } catch (err) {
    if (err instanceof Error && err.message.includes("AuthKit middleware")) {
      user = await getWorkosUserFromCookie()
    } else {
      throw err
    }
  }

  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? "unknown",
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
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
