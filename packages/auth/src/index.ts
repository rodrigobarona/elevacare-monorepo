export {
  type ElevaSession,
  type ProductLabel,
  UnauthorizedError,
} from "./types"
export {
  deriveProductLabel,
  capabilitiesFor,
  hasCapability,
  CAPABILITY_BUNDLES,
} from "./capabilities"
export {
  resolveSessionFromWorkosUser,
  requirePermission,
  withSessionContext,
} from "./session"
export { ensurePersonalOrg, findExistingPersonalOrg } from "./provisioning"
export {
  syncUser,
  softDeleteUser,
  syncOrganization,
  softDeleteOrganization,
  syncMembership,
  deleteMembership,
  type WorkOSUserEventData,
  type WorkOSOrganizationEventData,
  type WorkOSMembershipEventData,
} from "./sync"
export { withAuth, type WithAuthOptions } from "./proxy"
export {
  getSession,
  requireSession,
  getWidgetToken,
  getWidgetTokenFromSession,
} from "./server"
export { PermissionGate, usePermission, type ClientSessionShape } from "./react"
