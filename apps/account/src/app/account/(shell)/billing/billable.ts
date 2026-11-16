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

/**
 * Checkout and the billing portal act on the active workspace, so plans
 * show only while a practice or clinic is the active one.
 */
export function isActiveWorkspaceBillable(
  organizations: UserOrganization[] | null
): boolean {
  return (organizations ?? []).some(
    (org) => org.isCurrent && BILLABLE_ORG_TYPES.has(org.orgType)
  )
}
