import { z } from "zod"
import { LocaleSchema } from "@eleva/config/i18n"

// ---------------------------------------------------------------------------
// Shared Zod schemas (used by both client and server)
// ---------------------------------------------------------------------------

export const CompleteOnboardingRequestSchema = z.object({
  spaceName: z.string().min(2).max(100).trim(),
  locale: LocaleSchema.optional(),
})

export const SyncExistingOnboardingRequestSchema = z.object({}).optional()

export const CompleteOnboardingResponseSchema = z.object({
  ok: z.literal(true),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  slug: z.string(),
})

export const SyncExistingOnboardingResponseSchema = z.discriminatedUnion(
  "hasMembership",
  [
    z.object({ hasMembership: z.literal(false) }),
    z.object({
      hasMembership: z.literal(true),
      userId: z.string().uuid(),
      orgId: z.string().uuid(),
      slug: z.string(),
    }),
  ]
)

export const OrgTypeSchema = z.enum([
  "personal",
  "expert",
  "team",
  "academy",
  "staff",
])

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: OrgTypeSchema.default("personal"),
})

/** Workspace create flow — deliberate work orgs only (not personal onboarding). */
export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: z.enum(["expert", "team", "academy"]),
})

export const OrganizationSwitcherItemSchema = z.object({
  orgId: z.string().uuid(),
  orgSlug: z.string(),
  orgType: OrgTypeSchema,
  name: z.string(),
  membershipRole: z.enum(["admin", "member"]),
  productLabel: z.string(),
  isCurrent: z.boolean(),
})

export const ListOrganizationsMineResponseSchema = z.object({
  organizations: z.array(OrganizationSwitcherItemSchema),
})

export const CreateOrganizationResponseSchema = z.object({
  orgId: z.string().uuid(),
  slug: z.string(),
  created: z.boolean(),
})

export const GetOrganizationResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  type: z.string(),
})

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
})

export const SessionRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  activeOrganizationId: z.string().nullable().optional(),
  expiresAt: z.union([z.string(), z.date()]).optional(),
})

export const SessionResponseSchema = z
  .object({
    session: SessionRecordSchema.nullable(),
    user: SessionUserSchema.nullable(),
  })
  .nullable()

export const SetActiveOrganizationRequestSchema = z.object({
  organizationId: z.string().uuid(),
})

export const SetActiveOrganizationResponseSchema = z.object({
  ok: z.literal(true),
  organizationId: z.string().uuid(),
})

export const CreateMembershipRequestSchema = z.object({
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  role: z.enum(["admin", "member"]).default("member"),
})

export const BillingTierSchema = z.enum([
  "expert_community",
  "expert_top",
  "clinic_starter",
  "clinic_growth",
])

export const BillingCheckoutRequestSchema = z.object({
  tier: BillingTierSchema,
  quantity: z.number().int().min(1).max(100).optional(),
  returnUrl: z.string().url().optional(),
})

export const BillingCheckoutResponseSchema = z.object({
  sessionId: z.string(),
  clientSecret: z.string(),
})

export const BillingPortalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
})

export const BillingPortalResponseSchema = z.object({
  id: z.string(),
  url: z.string().url(),
})

export const BillingSubscribeRequestSchema = z.object({
  tier: BillingTierSchema,
  quantity: z.number().int().min(1).max(100).optional(),
})

export const BillingSubscribeResponseSchema = z.object({
  subscriptionId: z.string(),
  status: z.string(),
  clientSecret: z.string().nullable(),
})

export const ConnectComponentNameSchema = z.enum([
  "account_onboarding",
  "account_management",
  "notification_banner",
  "balances",
  "payouts",
  "payments",
  "tax_settings",
  "tax_registrations",
])

export const CreateAccountSessionRequestSchema = z.object({
  components: z.array(ConnectComponentNameSchema).min(1),
})

export const CreateAccountSessionResponseSchema = z.object({
  clientSecret: z.string(),
  expiresAt: z.number(),
})

export const CreateIdentitySessionResponseSchema = z.object({
  id: z.string(),
  clientSecret: z.string(),
  status: z.string(),
})

export const CreateConnectAccountRequestSchema = z.object({
  businessType: z.enum(["individual", "company"]).optional(),
})

export const CreateConnectAccountResponseSchema = z.object({
  stripeAccountId: z.string(),
  created: z.boolean(),
  detailsSubmitted: z.boolean(),
  payoutsEnabled: z.boolean(),
})

export const ApiErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
  message: z.string().optional(),
  retryAfter: z.number().optional(),
})

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>
export type SyncExistingOnboardingRequest = z.infer<
  typeof SyncExistingOnboardingRequestSchema
>
export type CompleteOnboardingResponse = z.infer<
  typeof CompleteOnboardingResponseSchema
>
export type SyncExistingOnboardingResponse = z.infer<
  typeof SyncExistingOnboardingResponseSchema
>
export type CreateOrganizationRequest = z.infer<
  typeof CreateOrganizationRequestSchema
>
export type CreateWorkspaceRequest = z.infer<
  typeof CreateWorkspaceRequestSchema
>
export type OrganizationSwitcherItem = z.infer<
  typeof OrganizationSwitcherItemSchema
>
export type ListOrganizationsMineResponse = z.infer<
  typeof ListOrganizationsMineResponseSchema
>
export type CreateOrganizationResponse = z.infer<
  typeof CreateOrganizationResponseSchema
>
export type GetOrganizationResponse = z.infer<
  typeof GetOrganizationResponseSchema
>
export type SessionResponse = z.infer<typeof SessionResponseSchema>
export type SetActiveOrganizationRequest = z.infer<
  typeof SetActiveOrganizationRequestSchema
>
export type SetActiveOrganizationResponse = z.infer<
  typeof SetActiveOrganizationResponseSchema
>
export type CreateMembershipRequest = z.infer<
  typeof CreateMembershipRequestSchema
>
export type BillingTier = z.infer<typeof BillingTierSchema>
export type BillingCheckoutRequest = z.infer<
  typeof BillingCheckoutRequestSchema
>
export type BillingCheckoutResponse = z.infer<
  typeof BillingCheckoutResponseSchema
>
export type BillingPortalRequest = z.infer<typeof BillingPortalRequestSchema>
export type BillingPortalResponse = z.infer<typeof BillingPortalResponseSchema>
export type BillingSubscribeRequest = z.infer<
  typeof BillingSubscribeRequestSchema
>
export type BillingSubscribeResponse = z.infer<
  typeof BillingSubscribeResponseSchema
>
export type ConnectComponentName = z.infer<typeof ConnectComponentNameSchema>
export type CreateAccountSessionRequest = z.infer<
  typeof CreateAccountSessionRequestSchema
>
export type CreateAccountSessionResponse = z.infer<
  typeof CreateAccountSessionResponseSchema
>
export type CreateConnectAccountRequest = z.infer<
  typeof CreateConnectAccountRequestSchema
>
export type CreateConnectAccountResponse = z.infer<
  typeof CreateConnectAccountResponseSchema
>
export type CreateIdentitySessionResponse = z.infer<
  typeof CreateIdentitySessionResponseSchema
>
export type ApiError = z.infer<typeof ApiErrorSchema>

// ── Avatar ──────────────────────────────────────────────────────────

export const UpdateAvatarRequestSchema = z.object({
  url: z.string().url(),
})

export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequestSchema>

export function isIanaTimeZone(value: string): boolean {
  if (/^[+-]\d/.test(value)) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const IanaTimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isIanaTimeZone, { message: "timezone must be a valid IANA name" })

const QuietHoursTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "quiet hours must be HH:MM")

export const NotificationChannelSchema = z.enum(["email", "sms", "in_app"])
export const NotificationCategorySchema = z.enum([
  "booking",
  "reminder",
  "payment",
  "marketing",
  "system",
])

export const MemberConsentKindSchema = z.enum([
  "terms",
  "privacy",
  "health_data_processing",
  "marketing",
])

export const MemberNotificationPreferenceSchema = z.object({
  channel: NotificationChannelSchema,
  category: NotificationCategorySchema,
  enabled: z.boolean(),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
  timezone: z.string().nullable(),
})

export const MeProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  timezone: z.string().nullable(),
  locale: LocaleSchema.nullable(),
  avatarUrl: z.string().nullable(),
  preferences: z.array(MemberNotificationPreferenceSchema),
})

export const PatchMeRequestSchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    timezone: IanaTimeZoneSchema.nullable().optional(),
    locale: LocaleSchema.nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.timezone !== undefined ||
      body.locale !== undefined ||
      body.avatarUrl !== undefined,
    { message: "at least one field is required" }
  )

export const PutNotificationPreferencesRequestSchema = z
  .object({
    timezone: IanaTimeZoneSchema.nullable().optional(),
    quietHoursStart: QuietHoursTimeSchema.nullable().optional(),
    quietHoursEnd: QuietHoursTimeSchema.nullable().optional(),
    preferences: z
      .array(
        z.object({
          channel: NotificationChannelSchema,
          category: NotificationCategorySchema,
          enabled: z.boolean(),
        })
      )
      .min(1)
      .max(15),
  })
  .superRefine((body, ctx) => {
    const start = body.quietHoursStart
    const end = body.quietHoursEnd
    if ((start == null) !== (end == null)) {
      ctx.addIssue({
        code: "custom",
        message:
          "quietHoursStart and quietHoursEnd must both be set or both be null",
        path: ["quietHoursEnd"],
      })
    }
    const keys = new Set<string>()
    for (const [index, preference] of body.preferences.entries()) {
      const key = `${preference.channel}:${preference.category}`
      if (keys.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "duplicate channel and category",
          path: ["preferences", index],
        })
      }
      keys.add(key)
    }
  })

export const ListMeBookingsQuerySchema = z.object({
  range: z.enum(["upcoming", "past"]).default("upcoming"),
  cursor: z.string().min(1).max(200).optional(),
})

export const MemberBookingSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  status: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string(),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  priceCents: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  expert: z.object({
    displayName: z.string(),
    username: z.string(),
  }),
  eventType: z.object({
    slug: z.string(),
    title: z.object({
      en: z.string(),
      pt: z.string().optional(),
      es: z.string().optional(),
    }),
  }),
})

export const ListMeBookingsResponseSchema = z.object({
  bookings: z.array(MemberBookingSchema),
  nextCursor: z.string().nullable(),
})

export const MemberPaymentSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: z.string(),
  amountCents: z.number().int(),
  currency: z.literal("EUR"),
  paidAt: z.string().datetime().nullable(),
  refundedCents: z.number().int().nonnegative(),
  receiptUrl: z.string().url().nullable(),
  stripeChargeId: z.string().nullable(),
})

export const ListMePaymentsQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
})

export const ListMePaymentsResponseSchema = z.object({
  payments: z.array(MemberPaymentSchema),
  nextCursor: z.string().nullable(),
})

export const MemberConsentSchema = z.object({
  kind: MemberConsentKindSchema,
  version: z.string(),
  grantedAt: z.string().datetime().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
  source: z.enum(["funnel", "account", "import"]).nullable(),
})

export const MeNotificationPreferencesResponseSchema = z.object({
  preferences: z.array(MemberNotificationPreferenceSchema),
})

export const ListMeConsentsResponseSchema = z.object({
  consents: z.array(MemberConsentSchema),
})

export const PutMeConsentRequestSchema = z.object({
  kind: MemberConsentKindSchema,
  granted: z.boolean(),
  version: z.string().min(1).max(64).optional(),
  locale: LocaleSchema.optional(),
})

export const CancelMeBookingResponseSchema = z.object({
  ok: z.literal(true),
  bookingId: z.string().uuid(),
})

export const RescheduleMeBookingRequestSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

export const RescheduleMeBookingResponseSchema = z.object({
  ok: z.literal(true),
  bookingId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

export const CreateDsarRequestResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "processing", "ready", "expired", "failed"]),
})

export const DsarRequestStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "processing", "ready", "expired", "failed"]),
  requestedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  downloadUrl: z.string().url().optional(),
})

export const DeleteAccountResponseSchema = z.object({
  requestId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
})

export const CancelDeletionResponseSchema = z.object({
  requestId: z.string().uuid(),
})

export type MeProfile = z.infer<typeof MeProfileSchema>
export type PatchMeRequest = z.infer<typeof PatchMeRequestSchema>
export type PutNotificationPreferencesRequest = z.infer<
  typeof PutNotificationPreferencesRequestSchema
>
export type ListMeBookingsQuery = z.infer<typeof ListMeBookingsQuerySchema>
export type ListMeBookingsResponse = z.infer<
  typeof ListMeBookingsResponseSchema
>
export type ListMePaymentsQuery = z.infer<typeof ListMePaymentsQuerySchema>
export type ListMePaymentsResponse = z.infer<
  typeof ListMePaymentsResponseSchema
>
export type ListMeConsentsResponse = z.infer<
  typeof ListMeConsentsResponseSchema
>
export type MeNotificationPreferencesResponse = z.infer<
  typeof MeNotificationPreferencesResponseSchema
>
export type PutMeConsentRequest = z.infer<typeof PutMeConsentRequestSchema>
export type CancelMeBookingResponse = z.infer<
  typeof CancelMeBookingResponseSchema
>
export type RescheduleMeBookingRequest = z.infer<
  typeof RescheduleMeBookingRequestSchema
>
export type RescheduleMeBookingResponse = z.infer<
  typeof RescheduleMeBookingResponseSchema
>
export type CreateDsarRequestResponse = z.infer<
  typeof CreateDsarRequestResponseSchema
>
export type DsarRequestStatusResponse = z.infer<
  typeof DsarRequestStatusResponseSchema
>
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>
export type CancelDeletionResponse = z.infer<
  typeof CancelDeletionResponseSchema
>

// ── Expert Profile ──────────────────────────────────────────────────

const LocalizedTextSchema = z.object({
  en: z.string(),
  pt: z.string().optional(),
  es: z.string().optional(),
})

export const PatchExpertProfileRequestSchema = z.object({
  nif: z.string().nullish(),
  licenseScope: z.string().nullish(),
  languages: z.array(z.string()).optional(),
  practiceCountries: z.array(z.string()).optional(),
  worldwideMode: z.boolean().optional(),
  sessionModes: z.array(z.enum(["online", "in_person", "phone"])).optional(),
  displayName: z.string().min(1).optional(),
  headline: z.string().nullish(),
  bio: z.string().nullish(),
})

export type PatchExpertProfileRequest = z.infer<
  typeof PatchExpertProfileRequestSchema
>

export const InvoicingRequestSchema = z.object({
  provider: z.enum(["toconline", "moloni", "manual"]),
})

export type InvoicingRequest = z.infer<typeof InvoicingRequestSchema>

export const EnsureExpertProfileRequestSchema = z.object({
  orgSlug: z.string().min(1).max(30),
  displayName: z.string().min(1).max(200),
})

export type EnsureExpertProfileRequest = z.infer<
  typeof EnsureExpertProfileRequestSchema
>

export const EnsureExpertProfileResponseSchema = z.object({
  ok: z.literal(true),
  profile: z.object({
    id: z.string().uuid(),
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
    status: z.string(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
})

export type EnsureExpertProfileResponse = z.infer<
  typeof EnsureExpertProfileResponseSchema
>

/** All completable expert onboarding / setup steps (API + metadata SSOT). */
export const ExpertOnboardingStepSchema = z.enum([
  "profile",
  "connect",
  "identity",
  "invoicing",
  "schedule",
  "event-types",
  "calendars",
  "review",
])

export type ExpertOnboardingStep = z.infer<typeof ExpertOnboardingStepSchema>

/** Ordered steps shown in the expert onboarding wizard UI. */
export const EXPERT_WIZARD_STEPS = [
  "profile",
  "connect",
  "identity",
  "invoicing",
  "schedule",
] as const satisfies readonly ExpertOnboardingStep[]

// ── Schedule ────────────────────────────────────────────────────────

export const SaveScheduleRequestSchema = z.object({
  timezone: z.string(),
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
})

export type SaveScheduleRequest = z.infer<typeof SaveScheduleRequestSchema>

export const DateOverrideRequestSchema = z.object({
  overrideDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isBlocked: z.boolean(),
  timezone: z.string(),
})

export type DateOverrideRequest = z.infer<typeof DateOverrideRequestSchema>

// ── Event Types ─────────────────────────────────────────────────────

export const CreateEventTypeRequestSchema = z.object({
  slug: z.string().optional(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.nullish(),
  durationMinutes: z.number().int().positive(),
  priceAmount: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  languages: z.array(z.string()),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  bookingWindowDays: z.number().int().positive().nullish(),
  minimumNoticeMinutes: z.number().int().nonnegative(),
  bufferBeforeMinutes: z.number().int().nonnegative(),
  bufferAfterMinutes: z.number().int().nonnegative(),
  cancellationWindowHours: z.number().int().positive().nullish(),
  rescheduleWindowHours: z.number().int().positive().nullish(),
  requiresApproval: z.boolean(),
  worldwideMode: z.boolean(),
})

export type CreateEventTypeRequest = z.infer<
  typeof CreateEventTypeRequestSchema
>

export const UpdateEventTypeRequestSchema =
  CreateEventTypeRequestSchema.partial().extend({
    published: z.boolean().optional(),
  })

export type UpdateEventTypeRequest = z.infer<
  typeof UpdateEventTypeRequestSchema
>

export const PublishEventTypeRequestSchema = z.object({
  published: z.boolean(),
})

export type PublishEventTypeRequest = z.infer<
  typeof PublishEventTypeRequestSchema
>

// ── Calendar Integrations ───────────────────────────────────────────

export const BusySourcesRequestSchema = z.object({
  sources: z.array(
    z.object({
      externalCalendarId: z.string(),
      displayName: z.string(),
    })
  ),
})

export type BusySourcesRequest = z.infer<typeof BusySourcesRequestSchema>

export const DestinationCalendarRequestSchema = z.object({
  externalCalendarId: z.string(),
})

export type DestinationCalendarRequest = z.infer<
  typeof DestinationCalendarRequestSchema
>

export const PublicLocalizedTextSchema = z.object({
  en: z.string(),
  pt: z.string().optional(),
  es: z.string().optional(),
})

export const ListPublicExpertsQuerySchema = z
  .object({
    category: z.string().min(1).max(80).optional(),
    language: z
      .string()
      .regex(/^[a-z]{2}$/)
      .optional(),
    minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    sort: z.enum(["relevance", "price", "rating"]).optional(),
    cursor: z.string().min(1).max(200).optional(),
  })
  .refine(
    (query) =>
      query.minPrice == null ||
      query.maxPrice == null ||
      query.minPrice <= query.maxPrice,
    {
      message: "minPrice must be less than or equal to maxPrice",
      path: ["minPrice"],
    }
  )

export const PublicExpertCardSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  headline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  languages: z.array(z.string()),
  serviceCountries: z.array(z.string()),
  categorySlugs: z.array(z.string()),
  minPriceCents: z.number().int().nullable(),
  topExpertActive: z.boolean(),
})

export const ListPublicExpertsResponseSchema = z.object({
  experts: z.array(PublicExpertCardSchema),
  nextCursor: z.string().nullable(),
})

export const PublicEventTypeModeSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["online", "in_person", "phone"]),
  priceCents: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  durationMinutes: z.number().int().positive(),
  countryScopeType: z.enum(["worldwide", "list"]),
  countryScopeCodes: z.array(z.string()),
  languages: z.array(z.string()),
  label: PublicLocalizedTextSchema.nullable(),
  location: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      city: z.string(),
      country: z.string(),
    })
    .nullable(),
})

export const PublicEventTypeSchema = z.object({
  slug: z.string(),
  title: PublicLocalizedTextSchema,
  description: PublicLocalizedTextSchema.nullable(),
  durationMinutes: z.number().int().positive(),
  priceAmount: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  languages: z.array(z.string()),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  modes: z.array(PublicEventTypeModeSchema),
})

export const PublicExpertProfileSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  languages: z.array(z.string()),
  serviceCountries: z.array(z.string()),
  categorySlugs: z.array(z.string()),
  eventTypes: z.array(PublicEventTypeSchema),
})

export const PublicEventTypeDetailSchema = PublicEventTypeSchema.extend({
  username: z.string(),
})

export const PublicSlotsQuerySchema = z.object({
  modeId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  tz: z.string().min(1).max(64),
  linkToken: z.string().min(8).max(256).optional(),
})

export const PublicSlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  startLocal: z.string(),
  endLocal: z.string(),
})

export const PublicSlotsResponseSchema = z.object({
  slots: z.array(PublicSlotSchema),
  priceCents: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(),
  scheduleId: z.string().uuid(),
})

export const PublicBookingLinkResponseSchema = z.object({
  eventTypeId: z.string().uuid(),
  eventTypeModeId: z.string().uuid().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  expiresAt: z.string().datetime(),
  note: z.string().max(2000).nullable(),
  username: z.string().min(3).max(30),
  eventSlug: z.string().min(1).max(80),
  expertDisplayName: z.string().min(1).max(200),
  eventTitle: PublicLocalizedTextSchema,
  modes: z.array(PublicEventTypeModeSchema).min(1),
})

export const ReserveBookingConsentSchema = z.object({
  kind: z.enum(["terms", "privacy", "health_data_processing"]),
  version: z.string().min(1).max(64),
})

export const ReserveBookingGuestSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(200).trim(),
  phone: z.string().min(8).max(32).optional(),
})

export const ReserveBookingRequestSchema = z.object({
  username: z.string().min(1).max(64).trim(),
  eventTypeModeId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().min(1).max(64),
  language: LocaleSchema,
  memberCountry: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/),
  linkToken: z.string().min(8).max(256).optional(),
  guest: ReserveBookingGuestSchema.optional(),
  phone: z.string().min(8).max(32).optional(),
  consents: z
    .array(ReserveBookingConsentSchema)
    .length(3)
    .refine((grants) => new Set(grants.map((grant) => grant.kind)).size === 3, {
      message: "consents must cover each kind exactly once",
    }),
})

export const ReserveBookingResponseSchema = z.object({
  reservationId: z.string().uuid(),
  reservationToken: z.string().min(16).max(128),
  expiresAt: z.string().datetime(),
})

export type ListPublicExpertsQuery = z.infer<
  typeof ListPublicExpertsQuerySchema
>
export type ListPublicExpertsResponse = z.infer<
  typeof ListPublicExpertsResponseSchema
>
export type PublicExpertProfile = z.infer<typeof PublicExpertProfileSchema>
export type PublicEventTypeMode = z.infer<typeof PublicEventTypeModeSchema>
export type PublicEventTypeDetail = z.infer<typeof PublicEventTypeDetailSchema>
export type PublicSlotsQuery = z.infer<typeof PublicSlotsQuerySchema>
export type PublicSlot = z.infer<typeof PublicSlotSchema>
export type PublicSlotsResponse = z.infer<typeof PublicSlotsResponseSchema>
export type PublicBookingLinkResponse = z.infer<
  typeof PublicBookingLinkResponseSchema
>
export const CreatePaymentIntentRequestSchema = z.object({
  reservationId: z.string().uuid(),
  reservationToken: z.string().min(16).max(128),
})

export const CreatePaymentIntentResponseSchema = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  bookingId: z.string().uuid(),
  publishableKey: z.string().min(1),
})

export const RefundBookingPaymentRequestSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  reason: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().min(8).max(255).optional(),
})

export const RefundBookingPaymentResponseSchema = z.object({
  refundId: z.string().uuid(),
  status: z.enum(["succeeded", "pending"]),
})

export const PayoutStatusSchema = z.enum([
  "pending",
  "scheduled",
  "approval_required",
  "transferred",
  "paid_out",
  "failed",
  "held",
  "reversal_pending",
  "reversed",
])

export const ListPayoutsQuerySchema = z.object({
  status: PayoutStatusSchema.optional(),
  orgId: z.string().uuid().optional(),
})

export const PayoutRowSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  bookingPaymentId: z.string().uuid(),
  status: PayoutStatusSchema,
  amountCents: z.number().int(),
  reversedCents: z.number().int(),
  eligibleAt: z.string(),
  holdReasons: z.array(z.enum(["dispute", "manual"])),
  stripeTransferId: z.string().nullable(),
})

export const ListPayoutsResponseSchema = z.object({
  payouts: z.array(PayoutRowSchema),
})

export const PayoutActionRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export const PayoutActionResponseSchema = z.object({
  id: z.string().uuid(),
  status: PayoutStatusSchema,
  holdReasons: z.array(z.enum(["dispute", "manual"])),
})

export const FinanceSummaryResponseSchema = z.object({
  summary: z.object({
    grossCents: z.number().int(),
    feesCents: z.number().int(),
    netCents: z.number().int(),
    pendingCents: z.number().int(),
    paidCents: z.number().int(),
  }),
  bookings: z.array(
    z.object({
      bookingId: z.string().uuid(),
      bookingPaymentId: z.string().uuid(),
      amountCents: z.number().int(),
      feeCents: z.number().int(),
      netCents: z.number().int(),
      payoutStatus: PayoutStatusSchema.nullable(),
      eligibleAt: z.string().nullable(),
    })
  ),
})

export const ConfirmBookingRequestSchema = z.object({
  reservationId: z.string().uuid(),
  reservationToken: z.string().min(16).max(128),
  paymentIntentId: z.string().min(1),
})

export const ConfirmBookingResponseSchema = z.object({
  bookingId: z.string().uuid(),
  alreadyConfirmed: z.boolean(),
})

export type ReserveBookingRequest = z.infer<typeof ReserveBookingRequestSchema>
export type ReserveBookingResponse = z.infer<
  typeof ReserveBookingResponseSchema
>
export type CreatePaymentIntentRequest = z.infer<
  typeof CreatePaymentIntentRequestSchema
>
export type CreatePaymentIntentResponse = z.infer<
  typeof CreatePaymentIntentResponseSchema
>
export type ConfirmBookingRequest = z.infer<typeof ConfirmBookingRequestSchema>
export type ConfirmBookingResponse = z.infer<
  typeof ConfirmBookingResponseSchema
>
export type RefundBookingPaymentRequest = z.infer<
  typeof RefundBookingPaymentRequestSchema
>
export type RefundBookingPaymentResponse = z.infer<
  typeof RefundBookingPaymentResponseSchema
>
export type ListPayoutsQuery = z.infer<typeof ListPayoutsQuerySchema>
export type ListPayoutsResponse = z.infer<typeof ListPayoutsResponseSchema>
export type PayoutActionRequest = z.infer<typeof PayoutActionRequestSchema>
export type PayoutActionResponse = z.infer<typeof PayoutActionResponseSchema>
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>
export type FinanceSummaryResponse = z.infer<
  typeof FinanceSummaryResponseSchema
>

export interface SubCalendar {
  id: string
  name: string
  primary: boolean
  email?: string
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ApiClientError extends Error {
  readonly status: number
  readonly body: ApiError

  constructor(status: number, body: ApiError) {
    super(body.error)
    this.name = "ApiClientError"
    this.status = status
    this.body = body
  }
}

export interface ApiClientOptions {
  baseUrl: string
  /** Bearer token for agent/M2M auth. Omit for cookie-based session auth. */
  bearerToken?: string
  /** Extra headers for server-side proxies that forward cookies or tracing. */
  headers?: Record<string, string>
  /** Custom fetch implementation (for testing or Node.js). */
  fetch?: typeof globalThis.fetch
  /** Optional abort signal applied to every request. */
  signal?: AbortSignal
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, bearerToken } = options
  const fetchFn = options.fetch ?? globalThis.fetch

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    }
    if (bearerToken) {
      headers["authorization"] = `Bearer ${bearerToken}`
    }

    const response = await fetchFn(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: bearerToken ? "omit" : "include",
      signal: options.signal,
    })

    const text = await response.text()

    if (!response.ok) {
      let error: ApiError
      try {
        error = JSON.parse(text) as ApiError
      } catch {
        error = { error: "unknown", message: text || `HTTP ${response.status}` }
      }
      throw new ApiClientError(response.status, error)
    }

    if (!text) return undefined as unknown as T
    return JSON.parse(text) as T
  }

  return {
    onboarding: {
      complete(data: CompleteOnboardingRequest) {
        return request<CompleteOnboardingResponse>(
          "POST",
          "/onboarding/complete",
          data
        )
      },
      syncExisting(data?: SyncExistingOnboardingRequest) {
        return request<SyncExistingOnboardingResponse>(
          "POST",
          "/onboarding/sync-existing",
          data
        )
      },
    },

    auth: {
      async getSession() {
        try {
          const raw = await request<unknown>("GET", "/auth/get-session")
          const parsed = SessionResponseSchema.safeParse(raw)
          if (!parsed.success) {
            console.error(
              "api-client: unexpected /auth/get-session payload",
              parsed.error.issues
            )
            return null
          }
          return parsed.data
        } catch (err) {
          if (
            err instanceof ApiClientError &&
            (err.status === 401 || err.status === 403)
          ) {
            return null
          }
          throw err
        }
      },
    },

    organizations: {
      listMine() {
        return request<ListOrganizationsMineResponse>(
          "GET",
          "/organizations/mine"
        )
      },
      create(data: CreateOrganizationRequest) {
        return request<CreateOrganizationResponse>(
          "POST",
          "/organizations",
          data
        )
      },
      getBySlug(slug: string) {
        return request<GetOrganizationResponse>(
          "GET",
          `/organizations?slug=${encodeURIComponent(slug)}`
        )
      },
      async setActive(data: SetActiveOrganizationRequest) {
        const raw = await request<unknown>(
          "POST",
          "/organizations/active",
          data
        )
        return SetActiveOrganizationResponseSchema.parse(raw)
      },
    },

    memberships: {
      create(data: CreateMembershipRequest) {
        return request<{ ok: true }>("POST", "/memberships", data)
      },
    },

    billing: {
      checkout(data: BillingCheckoutRequest) {
        return request<BillingCheckoutResponse>(
          "POST",
          "/billing/checkout",
          data
        )
      },
      portal(data: BillingPortalRequest = {}) {
        return request<BillingPortalResponse>("POST", "/billing/portal", data)
      },
      subscribe(data: BillingSubscribeRequest) {
        return request<BillingSubscribeResponse>(
          "POST",
          "/billing/subscribe",
          data
        )
      },
    },

    stripe: {
      identity: {
        createSession() {
          return request<CreateIdentitySessionResponse>(
            "POST",
            "/stripe/identity"
          )
        },
      },
      connectAccount: {
        create(data: CreateConnectAccountRequest = {}) {
          return request("POST", "/stripe/connect-account", data).then((raw) =>
            CreateConnectAccountResponseSchema.parse(raw)
          )
        },
      },
      accountSession: {
        create(data: CreateAccountSessionRequest) {
          return request<CreateAccountSessionResponse>(
            "POST",
            "/stripe/account-session",
            data
          )
        },
      },
    },

    users: {
      avatar: {
        get() {
          return request<{ avatarUrl: string | null }>("GET", "/users/avatar")
        },
        update(data: UpdateAvatarRequest) {
          return request<{ ok: true }>("PUT", "/users/avatar", data)
        },
        remove() {
          return request<{ ok: true }>("DELETE", "/users/avatar")
        },
      },
    },

    me: {
      async get() {
        const raw = await request<unknown>("GET", "/me")
        return MeProfileSchema.parse(raw)
      },
      async patch(data: PatchMeRequest) {
        const raw = await request<unknown>("PATCH", "/me", data)
        return MeProfileSchema.parse(raw)
      },
      async listBookings(query: ListMeBookingsQuery = { range: "upcoming" }) {
        const params = new URLSearchParams({ range: query.range })
        if (query.cursor) params.set("cursor", query.cursor)
        const raw = await request<unknown>(
          "GET",
          `/me/bookings?${params.toString()}`
        )
        return ListMeBookingsResponseSchema.parse(raw)
      },
      async listPayments(query: ListMePaymentsQuery = {}) {
        const params = new URLSearchParams()
        if (query.cursor) params.set("cursor", query.cursor)
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          qs ? `/me/payments?${qs}` : "/me/payments"
        )
        return ListMePaymentsResponseSchema.parse(raw)
      },
      async putNotificationPreferences(
        data: PutNotificationPreferencesRequest
      ) {
        const raw = await request<unknown>(
          "PUT",
          "/me/notification-preferences",
          data
        )
        return MeNotificationPreferencesResponseSchema.parse(raw)
      },
      async listConsents() {
        const raw = await request<unknown>("GET", "/me/consents")
        return ListMeConsentsResponseSchema.parse(raw)
      },
      async putConsent(data: PutMeConsentRequest) {
        const raw = await request<unknown>("PUT", "/me/consents", data)
        return ListMeConsentsResponseSchema.parse(raw)
      },
      async cancelBooking(bookingId: string) {
        const raw = await request<unknown>(
          "POST",
          `/me/bookings/${encodeURIComponent(bookingId)}/cancel`
        )
        return CancelMeBookingResponseSchema.parse(raw)
      },
      async rescheduleBooking(
        bookingId: string,
        data: RescheduleMeBookingRequest
      ) {
        const raw = await request<unknown>(
          "POST",
          `/me/bookings/${encodeURIComponent(bookingId)}/reschedule`,
          data
        )
        return RescheduleMeBookingResponseSchema.parse(raw)
      },
      async financeSummary() {
        const raw = await request<unknown>("GET", "/me/finance/summary")
        return FinanceSummaryResponseSchema.parse(raw)
      },
    },

    privacy: {
      async requestDsar() {
        const raw = await request<unknown>("POST", "/privacy/dsar")
        return CreateDsarRequestResponseSchema.parse(raw)
      },
      async getDsar(id: string) {
        const raw = await request<unknown>(
          "GET",
          `/privacy/dsar/${encodeURIComponent(id)}`
        )
        return DsarRequestStatusResponseSchema.parse(raw)
      },
      async deleteAccount() {
        const raw = await request<unknown>("POST", "/privacy/delete-account")
        return DeleteAccountResponseSchema.parse(raw)
      },
      async cancelDeletion() {
        const raw = await request<unknown>("POST", "/privacy/cancel-deletion")
        return CancelDeletionResponseSchema.parse(raw)
      },
    },

    experts: {
      profile: {
        ensure(data: EnsureExpertProfileRequest) {
          return request<EnsureExpertProfileResponse>(
            "POST",
            "/experts/profile/ensure",
            data
          )
        },
        patch(data: PatchExpertProfileRequest) {
          return request<{ ok: true }>("PATCH", "/experts/profile", data)
        },
        completeStep(step: string) {
          return request<{ ok: true }>(
            "POST",
            `/experts/profile/steps/${encodeURIComponent(step)}/complete`
          )
        },
        setInvoicing(data: InvoicingRequest) {
          return request<{ ok: true }>(
            "PUT",
            "/experts/profile/invoicing",
            data
          )
        },
      },
      schedule: {
        get() {
          return request<{ schedule: unknown }>("GET", "/experts/schedule")
        },
        save(data: SaveScheduleRequest) {
          return request<{ ok: true }>("PUT", "/experts/schedule", data)
        },
        addOverride(data: DateOverrideRequest) {
          return request<{ ok: true }>(
            "POST",
            "/experts/schedule/overrides",
            data
          )
        },
        removeOverride(overrideId: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/experts/schedule/overrides/${encodeURIComponent(overrideId)}`
          )
        },
      },
      eventTypes: {
        create(data: CreateEventTypeRequest) {
          return request<{ ok: true; id: string }>(
            "POST",
            "/experts/event-types",
            data
          )
        },
        update(id: string, data: UpdateEventTypeRequest) {
          return request<{ ok: true }>(
            "PATCH",
            `/experts/event-types/${encodeURIComponent(id)}`,
            data
          )
        },
        publish(id: string, data: PublishEventTypeRequest) {
          return request<{ ok: true }>(
            "PATCH",
            `/experts/event-types/${encodeURIComponent(id)}/publish`,
            data
          )
        },
        remove(id: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/experts/event-types/${encodeURIComponent(id)}`
          )
        },
      },
      integrations: {
        disconnect(integrationId: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/experts/integrations/${encodeURIComponent(integrationId)}`
          )
        },
        listCalendars(integrationId: string) {
          return request<{ calendars: SubCalendar[] }>(
            "GET",
            `/experts/integrations/${encodeURIComponent(integrationId)}/calendars`
          )
        },
        setBusySources(integrationId: string, data: BusySourcesRequest) {
          return request<{ ok: true }>(
            "PUT",
            `/experts/integrations/${encodeURIComponent(integrationId)}/busy-sources`,
            data
          )
        },
        setDestination(
          integrationId: string,
          data: DestinationCalendarRequest
        ) {
          return request<{ ok: true }>(
            "PUT",
            `/experts/integrations/${encodeURIComponent(integrationId)}/destination`,
            data
          )
        },
      },
    },

    public: {
      listExperts(query: ListPublicExpertsQuery = {}) {
        const params = new URLSearchParams()
        if (query.category) params.set("category", query.category)
        if (query.language) params.set("language", query.language)
        if (query.minPrice != null)
          params.set("minPrice", String(query.minPrice))
        if (query.maxPrice != null)
          params.set("maxPrice", String(query.maxPrice))
        if (query.sort) params.set("sort", query.sort)
        if (query.cursor) params.set("cursor", query.cursor)
        const qs = params.toString()
        return request<ListPublicExpertsResponse>(
          "GET",
          qs ? `/public/experts?${qs}` : "/public/experts"
        )
      },
      getExpert(username: string) {
        return request<PublicExpertProfile>(
          "GET",
          `/public/experts/${encodeURIComponent(username)}`
        )
      },
      getEventType(username: string, slug: string) {
        return request<PublicEventTypeDetail>(
          "GET",
          `/public/experts/${encodeURIComponent(username)}/event-types/${encodeURIComponent(slug)}`
        )
      },
      getSlots(username: string, slug: string, query: PublicSlotsQuery) {
        const params = new URLSearchParams({
          modeId: query.modeId,
          from: query.from,
          to: query.to,
          tz: query.tz,
        })
        if (query.linkToken) params.set("linkToken", query.linkToken)
        return request<PublicSlotsResponse>(
          "GET",
          `/public/experts/${encodeURIComponent(username)}/event-types/${encodeURIComponent(slug)}/slots?${params}`
        )
      },
      getBookingLink(token: string) {
        return request<PublicBookingLinkResponse>(
          "GET",
          `/public/booking-links/${encodeURIComponent(token)}`
        )
      },
    },

    bookings: {
      async reserve(data: ReserveBookingRequest) {
        const raw = await request<unknown>("POST", "/bookings/reserve", data)
        return ReserveBookingResponseSchema.parse(raw)
      },
      async confirm(data: ConfirmBookingRequest) {
        const raw = await request<unknown>("POST", "/bookings/confirm", data)
        return ConfirmBookingResponseSchema.parse(raw)
      },
    },

    payments: {
      async intent(data: CreatePaymentIntentRequest) {
        const raw = await request<unknown>("POST", "/payments/intent", data)
        return CreatePaymentIntentResponseSchema.parse(raw)
      },
      async refund(
        bookingPaymentId: string,
        data: RefundBookingPaymentRequest
      ) {
        const raw = await request<unknown>(
          "POST",
          `/payments/${encodeURIComponent(bookingPaymentId)}/refund`,
          data
        )
        return RefundBookingPaymentResponseSchema.parse(raw)
      },
    },

    payouts: {
      async list(query: ListPayoutsQuery = {}) {
        const params = new URLSearchParams()
        if (query.status) params.set("status", query.status)
        if (query.orgId) params.set("orgId", query.orgId)
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          qs ? `/payouts?${qs}` : "/payouts"
        )
        return ListPayoutsResponseSchema.parse(raw)
      },
      async approve(id: string, data: PayoutActionRequest) {
        const raw = await request<unknown>(
          "POST",
          `/payouts/${encodeURIComponent(id)}/approve`,
          data
        )
        return PayoutActionResponseSchema.parse(raw)
      },
      async hold(id: string, data: PayoutActionRequest) {
        const raw = await request<unknown>(
          "POST",
          `/payouts/${encodeURIComponent(id)}/hold`,
          data
        )
        return PayoutActionResponseSchema.parse(raw)
      },
      async release(id: string, data: PayoutActionRequest) {
        const raw = await request<unknown>(
          "POST",
          `/payouts/${encodeURIComponent(id)}/release`,
          data
        )
        return PayoutActionResponseSchema.parse(raw)
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
