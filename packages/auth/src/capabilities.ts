import type { OrgType, WorkosRole } from "@eleva/db/schema"
import type { ProductLabel } from "./types"

/**
 * Eleva product label derivation per identity-rbac-spec.md role catalog:
 *
 *   (personal, admin)       -> patient
 *   (solo_expert, admin)    -> expert
 *   (clinic, admin)         -> clinic_admin
 *   (clinic, member)        -> expert
 *   (eleva_operator, *)     -> eleva_operator
 *
 * Anything else throws. This function is pure; no DB/network access.
 */
export function deriveProductLabel(
  orgType: OrgType,
  workosRole: WorkosRole
): ProductLabel {
  if (orgType === "eleva_operator") return "eleva_operator"
  if (orgType === "personal" && workosRole === "admin") return "patient"
  if (orgType === "solo_expert" && workosRole === "admin") return "expert"
  if (orgType === "clinic" && workosRole === "admin") return "clinic_admin"
  if (orgType === "clinic" && workosRole === "member") return "expert"
  throw new Error(
    `Unsupported (orgType=${orgType}, workosRole=${workosRole}) combination`
  )
}

/**
 * RBAC bundle \u2192 capability-slug list. Keeps the mapping colocated with
 * the label-derivation logic so tests cover them together. Bundles live
 * in infra/workos/rbac-config.json; the source-of-truth loader in
 * @eleva/db reads the JSON, but for local test isolation we mirror the
 * catalog here.
 */
export const CAPABILITY_BUNDLES: Record<ProductLabel, readonly string[]> = {
  patient: [
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
  ],
  clinic_admin: [
    "events:manage",
    "schedule:manage",
    "bookings:manage_own",
    "reports:manage_own",
    "payouts:view_own",
    "members:manage",
    "billing:manage_org",
    "subscriptions:manage_org",
  ],
  eleva_operator: [
    "experts:approve",
    "experts:reject",
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
