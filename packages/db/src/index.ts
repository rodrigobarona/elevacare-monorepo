export { db, auditDb, __resetClientsForTests } from "./client"
export {
  withOrgContext,
  withPlatformAdminContext,
  __resetContextClientForTests,
  type Tx,
} from "./context"
export * as main from "./schema/main/index"
export * as audit from "./schema/audit/index"
export * as rls from "./rls/index"
export type { SessionMode } from "./schema/main/expert-profiles"
export {
  findExpertByUsername,
  findClinicBySlug,
  listCategories,
  listExperts,
  checkPublicSlugAvailability,
  type PublicExpertCard,
  type PublicExpertProfile,
  type PublicClinicProfile,
  type PublicCategory,
  type ListExpertsFilters,
  type ListExpertsResult,
  type SlugAvailability,
} from "./queries/public"
export { pingMainDb, pingAuditDb, type PingResult } from "./ping"
export {
  listApplications,
  getApplicationById,
  claimApplication,
  rejectApplication,
  approveApplication,
  getExpertProfileByUserId,
  updateExpertProfile,
  type AdminApplicationRow,
  type ListApplicationsFilters,
  type ListApplicationsResult,
  type ApproveApplicationResult,
} from "./queries/admin"
