import type { OrgType } from "@eleva/db/schema"
import type { MembershipRole, ProductLabel } from "./types"

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
 */
export type MembershipSeniority = MembershipRole | "owner"

/** Better Auth organization `owner` is the product `admin` equivalent. */
export function normalizeMembershipRole(
  role: MembershipSeniority
): MembershipRole {
  return role === "owner" ? "admin" : role
}

/** Narrow an arbitrary Better Auth `member.role` string to a seniority. */
export function toMembershipSeniority(role: string): MembershipSeniority {
  const slugs = new Set(
    role
      .split(",")
      .map((slug) => slug.trim().toLowerCase())
      .filter(Boolean)
  )
  if (slugs.has("owner")) return "owner"
  if (slugs.has("admin")) return "admin"
  return "member"
}

export function deriveProductLabel(
  orgType: OrgType,
  membershipRole: MembershipSeniority
): ProductLabel {
  const role = normalizeMembershipRole(membershipRole)
  if (orgType === "staff") return "staff"
  if (orgType === "personal" && role === "admin") return "member"
  if (orgType === "expert" && role === "admin") return "expert"
  if (orgType === "team" && role === "admin") return "team_admin"
  if (orgType === "team" && role === "member") return "expert"
  if ((orgType as string) === "academy" && role === "admin") return "lecturer"
  throw new Error(
    `Unsupported (orgType=${orgType}, membershipRole=${membershipRole}) combination`
  )
}

/**
 * RBAC bundle -> capability-slug list. Product labels derived from
 * (org_type, membership role).
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
