export {
  type ElevaSession,
  type ProductLabel,
  type MembershipRole,
  type ApiAuthMode,
  UnauthorizedError,
} from "./types"
export {
  deriveProductLabel,
  capabilitiesFor,
  hasCapability,
  CAPABILITY_BUNDLES,
  normalizeMembershipRole,
  toMembershipSeniority,
  canMutateStaffPayouts,
  isClinicClinician,
  PAYOUT_MUTATION_STAFF_ROLES,
} from "./capabilities"
export { resolveFinanceScope } from "./finance-scope"
export { requirePermission, withSessionContext } from "./session"
export { isPayoutMutationStaffRole } from "./permissions"
export {
  ensurePersonalOrg,
  findExistingPersonalOrg,
  ensureExpertProfileForOrg,
  completeOnboarding,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
} from "./provisioning"
export { provisionPersonalSpace } from "./provision-personal-space"
export {
  EXPERT_PRACTICE_EXISTS,
  expertPracticeViolation,
  findOwnedExpertPractice,
  type OwnedExpertPractice,
} from "./expert-practice"
export {
  PracticeClosureError,
  closeExpertPractice,
  getPracticeClosureState,
  reopenExpertPractice,
  type PracticeClosureState,
} from "./practice-closure"
export {
  isExpertInvoicingChoiceComplete,
  saveExpertInvoicingChoice,
  type ExpertInvoicingProvider,
  type ExpertInvoicingSetupStatus,
} from "./invoicing-choice"
export {
  getMemberProfile,
  updateMemberProfile,
  updateMemberNotificationPreferences,
  listMemberNotificationPreferences,
  type MemberProfile,
  type MemberNotificationPreference,
} from "./member"
export { updateUserLocale } from "./user-locale"
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
  type UserOrganizationItem,
  type CreateOrganizationInput,
  type CreateOrganizationResult,
} from "./organizations"
export {
  ClinicError,
  fileClinicVerification,
  getClinicSummary,
  updateClinicProfile,
  type ClinicErrorCode,
  type ClinicProfilePatch,
  type ClinicSummary,
} from "./clinics"
export {
  TEAM_INVITATION_TTL_MS,
  TEAM_MEMBER_LIMIT,
  TeamMemberError,
  cancelTeamInvitation,
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  type InviteTeamMemberResult,
  type RemoveTeamMemberResult,
  type TeamInvitation,
  type TeamInviteRole,
  type TeamMember,
  type TeamMemberErrorCode,
  type TeamRoster,
} from "./team-members"
export { getProviderAccessToken, revokeProviderGrant } from "./provider-token"
export {
  markCalendarIntegrationExpired,
  releaseCalendarAccount,
  syncExpertCalendarAccounts,
  withoutCalendarScopes,
} from "./calendar-accounts"
export {
  LOGIN_PATH,
  guardSession,
  guardSessionForOrg,
  redirectToGatewayLogin,
} from "./guards"
export { PermissionGate, usePermission, type ClientSessionShape } from "./react"
export { SESSION_COOKIE_NAMES } from "./server/credentials"
