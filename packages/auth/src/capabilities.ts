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
 * NOTE: WorkOS `admin`/`member` roles hold capability supersets synced from
 * infra/workos/rbac-config.json. JWT `permissions` are intersected with the
 * derived product bundle in session resolution.
 */
export type MembershipSeniority = WorkosRole | "owner"

/** Better Auth organization `owner` is the WorkOS `admin` equivalent. */
export function normalizeMembershipRole(role: MembershipSeniority): WorkosRole {
  return role === "owner" ? "admin" : role
}

export function deriveProductLabel(
  orgType: OrgType,
  workosRole: MembershipSeniority
): ProductLabel {
  const role = normalizeMembershipRole(workosRole)
  if (orgType === "staff") return "staff"
  if (orgType === "personal" && role === "admin") return "member"
  if (orgType === "expert" && role === "admin") return "expert"
  if (orgType === "team" && role === "admin") return "team_admin"
  if (orgType === "team" && role === "member") return "expert"
  if ((orgType as string) === "academy" && role === "admin") return "lecturer"
  throw new Error(
    `Unsupported (orgType=${orgType}, workosRole=${workosRole}) combination`
  )
}

/**
 * RBAC bundle -> capability-slug list. Product labels derived from
 * (org_type, workos_role). WorkOS role supersets in rbac-config.json are
 * intersected at runtime in packages/auth/src/session.ts.
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
