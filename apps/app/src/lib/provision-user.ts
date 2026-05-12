import { WorkOS } from "@workos-inc/node"
import {
  ensurePersonalOrg,
  resolveSessionFromWorkosUser,
  type ElevaSession,
} from "@eleva/auth"

let _workos: WorkOS | null = null

function getWorkOS(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required")
    _workos = new WorkOS(key)
  }
  return _workos
}

interface WorkOSUserInfo {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

/**
 * First-sign-in provisioning. Called when a valid WorkOS session exists
 * but no Eleva DB records have been created yet.
 *
 * 1. If WorkOS already assigned an organizationId (e.g. auto-enrollment),
 *    use it directly.
 * 2. Otherwise create a personal org on WorkOS.
 * 3. Mirror user + org + membership into Eleva's DB via ensurePersonalOrg.
 * 4. Return the freshly resolved session.
 */
export async function provisionNewUser(
  user: WorkOSUserInfo,
  organizationId: string | undefined
): Promise<ElevaSession | null> {
  let workosOrgId = organizationId

  if (!workosOrgId) {
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    const org = await getWorkOS().organizations.createOrganization({
      name: `${displayName} (personal)`,
    })
    workosOrgId = org.id
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || null

  await ensurePersonalOrg({
    workosUserId: user.id,
    workosOrgId,
    email: user.email,
    displayName,
  })

  return resolveSessionFromWorkosUser(user.id)
}
