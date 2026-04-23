import { and, eq, isNull } from "drizzle-orm"
import { db, withOrgContext } from "@eleva/db"
import { main } from "@eleva/db"
import { capabilitiesFor, deriveProductLabel } from "./capabilities"
import { UnauthorizedError, type ElevaSession } from "./types"

/**
 * Resolve an Eleva session from a verified WorkOS user id. Returns null
 * when the user has no active memberships (new-sign-up race; the caller
 * usually triggers ensurePersonalOrg in that case).
 */
export async function resolveSessionFromWorkosUser(
  workosUserId: string,
  opts: { preferredOrgId?: string } = {}
): Promise<ElevaSession | null> {
  const rows = await db()
    .select({
      userId: main.users.id,
      email: main.users.email,
      displayName: main.users.displayName,
      orgId: main.organizations.id,
      workosOrgId: main.organizations.workosOrgId,
      orgType: main.organizations.type,
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

  const preferred = opts.preferredOrgId
    ? rows.find((r) => r.orgId === opts.preferredOrgId)
    : undefined
  const picked = preferred ?? rows[0]!

  const productLabel = deriveProductLabel(picked.orgType, picked.workosRole)
  const capabilities = capabilitiesFor(productLabel)

  return {
    user: {
      id: picked.userId,
      workosUserId,
      email: picked.email,
      displayName: picked.displayName,
    },
    orgId: picked.orgId,
    workosOrgId: picked.workosOrgId,
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
