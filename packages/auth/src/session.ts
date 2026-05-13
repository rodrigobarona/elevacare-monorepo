import { and, eq, isNull } from "drizzle-orm"
import { db, withOrgContext } from "@eleva/db"
import { main } from "@eleva/db"
import { capabilitiesFor, deriveProductLabel } from "./capabilities"
import { UnauthorizedError, type ElevaSession } from "./types"

/**
 * PII provided by the AuthKit session token. Passed in by the caller
 * (getSession) so the DB query stays PII-free.
 */
export interface WorkOSTokenUser {
  email: string
  firstName?: string | null
  lastName?: string | null
}

/**
 * Resolve an Eleva session from a verified WorkOS user id. Returns null
 * when the user has no active memberships (new-sign-up race; the caller
 * usually triggers ensurePersonalOrg in that case).
 *
 * PII (email, displayName) comes from the WorkOS token, not the DB.
 */
export async function resolveSessionFromWorkosUser(
  workosUserId: string,
  tokenUser: WorkOSTokenUser,
  opts: { preferredOrgId?: string; preferredOrgSlug?: string } = {}
): Promise<ElevaSession | null> {
  const rows = await db()
    .select({
      userId: main.users.id,
      avatarUrl: main.users.avatarUrl,
      orgId: main.organizations.id,
      workosOrgId: main.organizations.workosOrgId,
      orgType: main.organizations.type,
      orgSlug: main.organizations.slug,
      workosRole: main.memberships.workosRole,
      status: main.memberships.status,
    })
    .from(main.users)
    .innerJoin(main.memberships, eq(main.memberships.userId, main.users.id))
    .innerJoin(
      main.organizations,
      eq(main.organizations.id, main.memberships.orgId)
    )
    .where(
      and(
        eq(main.users.workosUserId, workosUserId),
        eq(main.memberships.status, "active"),
        isNull(main.users.deletedAt),
        isNull(main.organizations.deletedAt)
      )
    )

  if (rows.length === 0) return null

  const preferred =
    (opts.preferredOrgSlug
      ? rows.find((r) => r.orgSlug === opts.preferredOrgSlug)
      : undefined) ??
    (opts.preferredOrgId
      ? rows.find((r) => r.orgId === opts.preferredOrgId)
      : undefined)
  const picked = preferred ?? rows[0]!

  const productLabel = deriveProductLabel(picked.orgType, picked.workosRole)
  const capabilities = capabilitiesFor(productLabel)

  const displayName =
    [tokenUser.firstName, tokenUser.lastName].filter(Boolean).join(" ") ||
    tokenUser.email

  return {
    user: {
      id: picked.userId,
      workosUserId,
      email: tokenUser.email,
      displayName,
      avatarUrl: picked.avatarUrl,
    },
    orgId: picked.orgId,
    workosOrgId: picked.workosOrgId,
    orgSlug: picked.orgSlug,
    productLabel,
    workosRole: picked.workosRole,
    capabilities,
  }
}

/**
 * Throws UnauthorizedError('missing-capability') if the session lacks
 * the requested capability. Returns the session on success so callers
 * can chain: const { orgId } = await requirePermission('reports:manage_own').
 */
export function requirePermission(
  session: ElevaSession | null,
  capability: string
): asserts session is ElevaSession {
  if (!session) {
    throw new UnauthorizedError("no-session")
  }
  if (!session.capabilities.includes(capability)) {
    throw new UnauthorizedError("missing-capability", `missing: ${capability}`)
  }
}

/**
 * Runs `fn` inside withOrgContext(session.orgId, ...). Convenience for
 * server actions that always need the active tenant's RLS scope.
 */
export async function withSessionContext<T>(
  session: ElevaSession,
  fn: Parameters<typeof withOrgContext<T>>[1]
): Promise<T> {
  return withOrgContext(session.orgId, fn)
}
