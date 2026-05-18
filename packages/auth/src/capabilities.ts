import type { OrgType, WorkosRole } from "@eleva/db/schema"
import type { ProductLabel } from "./types"

/**
 * Eleva product label derivation per identity-rbac-spec.md role catalog:
 *
 *   (personal, admin)       -> member
 *   (expert, admin)         -> expert
 *   (team, admin)           -> team_admin
 *   (team, member)          -> expert
 *   (academy, admin)        -> lecturer
 *   (staff, *)              -> staff
 *
 * Anything else throws. This function is pure; no DB/network access.
 *
 * NOTE: This is the FALLBACK derivation. With custom WorkOS environment
 * roles, the JWT `permissions` claim is the primary source of truth.
 * This function is used when JWT claims are unavailable (e.g. during
 * provisioning or in test contexts).
 */
export function deriveProductLabel(
  orgType: OrgType,
  workosRole: WorkosRole
): ProductLabel {
  if (orgType === "staff") return "staff"
  if (orgType === "personal" && workosRole === "admin") return "member"
  if (orgType === "expert" && workosRole === "admin") return "expert"
  if (orgType === "team" && workosRole === "admin") return "team_admin"
  if (orgType === "team" && workosRole === "member") return "expert"
  if ((orgType as string) === "academy" && workosRole === "admin")
    return "lecturer"
  throw new Error(
    `Unsupported (orgType=${orgType}, workosRole=${workosRole}) combination`
  )
}

/**
 * Maps WorkOS custom role slugs to Eleva product labels.
 * Used when reading the `role` claim from the JWT access token.
 */
export const WORKOS_ROLE_TO_LABEL: Record<string, ProductLabel> = {
  member: "member",
  expert: "expert",
  team_admin: "team_admin",
  lecturer: "lecturer",
  staff: "staff",
  admin: "team_admin",
}

/**
 * RBAC bundle -> capability-slug list. Mirrors the roles defined in
 * infra/workos/rbac-config.json. With custom WorkOS environment roles,
 * these are pushed to WorkOS and returned via JWT `permissions` claim.
 * This map remains as fallback for local test isolation and validation.
 */
export const CAPABILITY_BUNDLES: Record<ProductLabel, readonly string[]> = {
  member: [
    "appointments:view_own",
    "sessions:view_own",
    "billing:view_own",
    "diary:share",
  ],
  expert: [
    "events:manage",
    "schedule:manage",
    "bookings:manage_own",
    "reports:manage_own",
    "payouts:view_own",
    "expert:onboard",
    "expert:profile_edit",
    "expert:invoicing_manage",
  ],
  team_admin: [
    "events:manage",
    "schedule:manage",
    "bookings:manage_own",
    "reports:manage_own",
    "payouts:view_own",
    "expert:onboard",
    "expert:profile_edit",
    "expert:invoicing_manage",
    "members:manage",
    "billing:manage_org",
    "subscriptions:manage_org",
  ],
  lecturer: [
    "courses:manage",
    "courses:create",
    "courses:publish",
    "academy:analytics_view",
    "payouts:view_own",
  ],
  staff: [
    "experts:approve",
    "experts:reject",
    "applications:review",
    "applications:claim",
    "users:view_all",
    "payments:view_all",
    "payouts:approve",
    "audit:view_all",
    "workflows:retry",
    "accounting:reconcile",
    "usernames:reserve",
    "usernames:rename",
  ],
}

export function capabilitiesFor(label: ProductLabel): readonly string[] {
  return CAPABILITY_BUNDLES[label]
}

export function hasCapability(
  capabilities: readonly string[],
  needed: string
): boolean {
  return capabilities.includes(needed)
}
