import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access"

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
  adminPayout: ["view", "approve"],
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

export const staffSupport = adminAc
export const staffFinance = adminAc
export const platformAdmin = adminAc

export const adminRoles = {
  user: userAc,
  staff_support: staffSupport,
  staff_finance: staffFinance,
  platform_admin: platformAdmin,
}

export const adminAccess = defaultAc

export { statement }
