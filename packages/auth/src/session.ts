import { withOrgContext } from "@eleva/db"
import {
  UnauthorizedError,
  type ElevaSession,
  type ProductLabel,
} from "./types"

/**
 * Capabilities that must be present when trusting JWT permissions over the
 * derived product bundle (guards against stale partial JWTs after org switch).
 */
const JWT_REQUIRED_CAPABILITIES: Partial<
  Record<ProductLabel, readonly string[]>
> = {
  member: ["appointments:view_own"],
  expert: ["events:manage"],
  team_admin: ["events:manage"],
  lecturer: ["courses:manage"],
}

/**
 * Resolve session capabilities from JWT permissions or the derived bundle.
 * Exported for unit tests.
 */
export function resolveSessionCapabilities(
  productLabel: ProductLabel,
  derivedCapabilities: readonly string[],
  opts: {
    jwtMatchesPicked: boolean
    jwtPermissions?: string[]
  }
): readonly string[] {
  const { jwtMatchesPicked, jwtPermissions } = opts

  const jwtCapabilities =
    jwtMatchesPicked && jwtPermissions && jwtPermissions.length > 0
      ? jwtPermissions.filter((capability) =>
          derivedCapabilities.includes(capability)
        )
      : []

  if (jwtCapabilities.length === 0) {
    return derivedCapabilities
  }

  const required = JWT_REQUIRED_CAPABILITIES[productLabel]
  if (
    required &&
    !required.every((capability) => jwtCapabilities.includes(capability))
  ) {
    return derivedCapabilities
  }

  return jwtCapabilities
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
