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
export {
  ensurePersonalOrg,
  findExistingPersonalOrg,
  provisionUser,
  provisionOrganization,
  provisionMembership,
  completeOnboarding,
  type ProvisionUserInput,
  type ProvisionUserResult,
  type ProvisionOrganizationInput,
  type ProvisionOrganizationResult,
  type ProvisionMembershipInput,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
} from "./provisioning"
export {
  SYNC_EVENTS,
  type SyncEventType,
  type ExternalIdWriteBack,
  processWorkOSEvent,
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
export {
  createAuthProxy,
  createPassthroughProxy,
  STANDARD_APP_MATCHER,
  PASSTHROUGH_APP_MATCHER,
  DEFAULT_UNAUTHENTICATED_PATHS,
  type AuthProxyOptions,
  type ProxyHandler,
  type RedirectStrategy,
} from "./proxy"
export {
  type AuthUser,
  getAuthUser,
  getSession,
  getSessionForOrg,
  requireSession,
  getWidgetToken,
  getWidgetTokenFromSession,
} from "./server"
export { LOGIN_PATH, guardSession, guardSessionForOrg } from "./guards"
export { PermissionGate, usePermission, type ClientSessionShape } from "./react"
