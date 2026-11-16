import type { UserOrganization } from "@eleva/auth/server"

/** Plans are for expert practices and clinics, not for a person's Space. */
const BILLABLE_ORG_TYPES = new Set(["expert", "team"])

export function hasBillableWorkspace(
  organizations: UserOrganization[] | null
): boolean {
  return (organizations ?? []).some((org) =>
    BILLABLE_ORG_TYPES.has(org.orgType)
  )
}
