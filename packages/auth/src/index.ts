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
export { ensurePersonalOrg } from "./provisioning"
export { withAuth, type WithAuthOptions } from "./proxy"
export {
  getSession,
  requireSession,
  getWidgetToken,
  getWidgetTokenFromSession,
} from "./server"
export { PermissionGate, usePermission, type ClientSessionShape } from "./react"
