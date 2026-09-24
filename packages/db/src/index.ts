export { db, auditDb, __resetClientsForTests } from "./client"
export {
  withOrgContext,
  withOrgAndUserContext,
  withUserContext,
  withPlatformAdminContext,
  withPlatformAdminUserContext,
  __resetContextClientForTests,
  type Tx,
} from "./context"
export * as main from "./schema/main/index"
export * as auth from "./schema/auth/index"
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
  updateExpertProfile,
  getOrganizationBySlug,
} from "./queries/admin"
export {
  listExpertEventTypes,
  getEventType,
  lockEventTypeForUpdate,
  createEventType,
  updateEventType,
  deleteEventType,
  findPublicEventType,
  listPublicEventTypes,
} from "./queries/event-types"
export {
  listEventTypeModes,
  getEventTypeMode,
  createEventTypeMode,
  updateEventTypeMode,
  deactivateEventTypeMode,
  listEventTypeModesWithLocation,
} from "./queries/event-type-modes"
export type { EventTypeModeWithLocation } from "./queries/event-type-modes"
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
  listSchedules,
  createSchedule,
  updateSchedule,
  softDeleteSchedule,
  countModesUsingSchedule,
  listModeNamesUsingSchedule,
  replaceDateOverrides,
} from "./queries/schedules"
export {
  listPracticeLocations,
  getPracticeLocation,
  createPracticeLocation,
  updatePracticeLocation,
  archivePracticeLocation,
  countModesUsingLocation,
  listModeNamesUsingLocation,
  listPublishedActiveModesForExpert,
} from "./queries/locations"
export {
  getExpertScheduleForBooking,
  getScheduleForBooking,
  listExpertBusyBookings,
  type BookingScheduleData,
} from "./queries/booking-public"
export { loadOfferForResolve } from "./queries/offer-resolve"
export {
  listPublicMarketplaceExperts,
  listPublicEventTypeModes,
  findUsableBookingLink,
  isBookingLinkUsable,
  decodeMarketplaceCursor,
  encodeMarketplaceCursor,
  type MarketplaceSort,
  type ListMarketplaceExpertsInput,
  type MarketplaceExpertCard,
  type ListMarketplaceExpertsResult,
  type PublicEventTypeMode,
  type PublicBookingLink,
} from "./queries/public-offers"
export {
  deriveBookingLinkStatus,
  toBookingLinkListItem,
  listBookingLinksForEventType,
  createBookingLink,
  getBookingLinkForExpert,
  revokeBookingLink,
  type BookingLinkStatus,
} from "./queries/booking-links"
export type { BookingLink, NewBookingLink } from "./schema/main/offer-model"
export {
  listCalendarIntegrations,
  listExpertIntegrations,
  listBusySourcesForExpert,
  getDestinationCalendar,
  disconnectIntegration,
  replaceBusySources,
  replaceDestinationCalendar,
} from "./queries/calendars"
export {
  assertExpertOwnsCalendarIntegration,
  setEventTypeDestination,
  setEventTypeModeDestination,
  resolveBookingDestination,
  type DestinationOverridePatch,
  type ResolvedDestination,
} from "./queries/destination-overrides"
export {
  getActiveCalendarFeedToken,
  rotateCalendarFeedToken,
  revokeCalendarFeedToken,
  findActiveCalendarFeedTokenByHash,
} from "./queries/calendar-feed-tokens"
export {
  listExpertBookings,
  listExpertBookingsForFeed,
  type ExpertBookingListItem,
} from "./queries/expert-bookings"
export type { CalendarFeedToken } from "./schema/main/offer-model"
export {
  getUserAvatarUrl,
  updateUserAvatarUrl,
  getAuthUserRole,
} from "./queries/users"
export {
  getMemberProfile,
  updateMemberProfileRow,
  listMemberNotificationPreferences,
  upsertMemberNotificationPreferencesInTx,
  listMemberBookings,
  listMemberPayments,
  getMemberBookingForPolicy,
  cacheBookingPaymentReceipt,
  lockMemberHealthConsentInvariant,
  memberHasConfirmedFutureBooking,
  type MemberProfile,
  type MemberNotificationPreference,
  type MemberBookingListItem,
  type MemberPaymentListItem,
  type MemberBookingPolicyRow,
  type MemberListResult,
} from "./queries/member"
export { countBillableSeats } from "./queries/seats"
export type {
  LocalizedRichText,
  LocalizedRichTextEntry,
  LocalizedText,
} from "./schema/main/shared"
