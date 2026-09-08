export {
  type ElevaSession,
  type ProductLabel,
  type MembershipRole,
  type ApiAuthMode,
  UnauthorizedError,
} from "./types"
export { isAlreadySignedOut } from "./server/already-signed-out"
export {
  deriveProductLabel,
  capabilitiesFor,
  hasCapability,
  CAPABILITY_BUNDLES,
  normalizeMembershipRole,
  toMembershipSeniority,
} from "./capabilities"
export { requirePermission, withSessionContext } from "./session"
export {
  ensurePersonalOrg,
  findExistingPersonalOrg,
  ensureExpertProfileForOrg,
  completeOnboarding,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
} from "./provisioning"
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
  requireOrg,
  getCapabilities,
  getAuthenticatedLocale,
  refreshSessionEntitlements,
} from "./server"
export {
  listUserOrganizations,
  listAuthOrganizations,
  createOrganization,
  createElevaOrganization,
  setActiveElevaOrganization,
  OrganizationForbiddenError,
  addOrganizationMember,
  type UserOrganizationItem,
  type CreateOrganizationInput,
  type CreateOrganizationResult,
} from "./organizations"
export { getProviderAccessToken } from "./provider-token"
export { syncExpertCalendarAccounts } from "./calendar-accounts"
export { LOGIN_PATH, guardSession, guardSessionForOrg } from "./guards"
export { PermissionGate, usePermission, type ClientSessionShape } from "./react"
export { SESSION_COOKIE_NAMES } from "./server/credentials"
