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
export type {
  SessionMode,
  StripeIdentityStatus,
  InvoicingSetupStatus,
  ExpertProfile,
} from "./schema/main/expert-profiles"
export type { ExpertIntegration } from "./schema/main/expert-integrations"
export {
  findExpertByUsername,
  findClinicBySlug,
  listCategories,
  listExperts,
  checkPublicSlugAvailability,
  findExistingOrgSlugs,
  type PublicExpertCard,
  type PublicExpertProfile,
  type PublicClinicProfile,
  type PublicCategory,
  type ListExpertsFilters,
  type ListExpertsResult,
  type SlugAvailability,
} from "./queries/public"
export { pingMainDb, pingAuditDb } from "./ping"
export {
  getExpertProfileByUserId,
  getExpertProfileForOrg,
  ensureExpertProfileForOrg,
  ensureExpertProfileForOrgDetailed,
  updateExpertProfile,
  getOrganizationBySlug,
  type EnsureExpertProfileResult,
} from "./queries/admin"
export {
  listExpertEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  findPublicEventType,
  listPublicEventTypes,
} from "./queries/event-types"
export {
  getDefaultSchedule,
  getOrCreateDefaultSchedule,
  getSchedule,
  updateScheduleTimezone,
  listAvailabilityRules,
  replaceAvailabilityRules,
  listDateOverrides,
  upsertDateOverride,
  deleteDateOverride,
} from "./queries/schedules"
export {
  getExpertScheduleForBooking,
  listExpertBusyBookings,
  type BookingScheduleData,
} from "./queries/booking-public"
export {
  listCalendarIntegrations,
  listExpertIntegrations,
  disconnectIntegration,
  replaceBusySources,
  replaceDestinationCalendar,
} from "./queries/calendars"
export { getUserAvatarUrl, updateUserAvatarUrl } from "./queries/users"
export type { LocalizedText } from "./schema/main/shared"
