import { createAccessControl } from "better-auth/plugins/access"
import { defaultAc, userAc } from "better-auth/plugins/admin/access"

const statement = {
  organization: ["create", "update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  billing: ["view", "manage"],
  booking: ["view", "manage"],
  schedule: ["view", "manage"],
  eventType: ["view", "manage"],
  record: ["view", "manage"],
  report: ["view", "manage"],
  invoicing: ["view", "manage"],
  integration: ["view", "manage"],
  adminUser: ["list", "set-role"],
  adminPayout: ["view", "approve", "hold", "refund"],
  adminAccounting: ["reconcile"],
  adminFlag: ["manage"],
} as const

export const ac = createAccessControl(statement)

export const owner = ac.newRole({
  organization: ["create", "update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  billing: ["view", "manage"],
  booking: ["view", "manage"],
  schedule: ["view", "manage"],
  eventType: ["view", "manage"],
  record: ["view", "manage"],
  report: ["view", "manage"],
  invoicing: ["view", "manage"],
  integration: ["view", "manage"],
})

export const admin = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  billing: ["view", "manage"],
  booking: ["view", "manage"],
  schedule: ["view", "manage"],
  eventType: ["view", "manage"],
  record: ["view", "manage"],
  report: ["view", "manage"],
  invoicing: ["view", "manage"],
  integration: ["view", "manage"],
})

export const member = ac.newRole({
  booking: ["view"],
  schedule: ["view"],
  eventType: ["view"],
  record: ["view"],
  report: ["view"],
})

export const organizationRoles = { owner, admin, member }

/**
 * Better Auth admin-plugin user roles (`/auth/admin/*`), least privilege.
 * They bind to the plugin's `defaultAc`, not organization `ac` statements
 * such as `adminPayout`. Payout mutations are gated by
 * `PAYOUT_MUTATION_STAFF_ROLES` in `requireStaffPayoutMutator`.
 *
 * No staff role may impersonate, set a password, email or phone, delete
 * or edit a user: those paths would let staff read members' health
 * records or take over an account without a trace (D-11: staff never
 * read plaintext). Support and finance are read-only; only
 * `platform_admin` may grant roles, ban, and revoke sessions.
 */
export const staffSupport = defaultAc.newRole({
  user: ["list", "get"],
  session: ["list"],
})
export const staffFinance = defaultAc.newRole({
  user: ["list", "get"],
  session: ["list"],
})
export const platformAdmin = defaultAc.newRole({
  user: ["create", "list", "get", "set-role", "ban"],
  session: ["list", "revoke"],
})

export const adminRoles = {
  user: userAc,
  staff_support: staffSupport,
  staff_finance: staffFinance,
  platform_admin: platformAdmin,
}

export const adminAccess = defaultAc

/** Better Auth admin roles allowed to approve, hold, release, or refund payouts. */
export const PAYOUT_MUTATION_STAFF_ROLES = [
  "platform_admin",
  "staff_finance",
] as const

export type PayoutMutationStaffRole =
  (typeof PAYOUT_MUTATION_STAFF_ROLES)[number]

export function isPayoutMutationStaffRole(
  role: string | null | undefined
): role is PayoutMutationStaffRole {
  return PAYOUT_MUTATION_STAFF_ROLES.some((allowed) => allowed === role)
}

export { statement }
