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

export const InvoicingRequestSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("toconline") }),
  z.object({ provider: z.literal("moloni") }),
  z.object({
    provider: z.literal("manual"),
    acknowledged: z.literal(true),
  }),
])

export type InvoicingRequest = z.infer<typeof InvoicingRequestSchema>

export const ConnectAccountingProviderSchema = z.enum(["toconline", "moloni"])
export type ConnectAccountingProvider = z.infer<
  typeof ConnectAccountingProviderSchema
>

export const ConnectAccountingResponseSchema = z.object({
  url: z.string().url(),
})

export type ConnectAccountingResponse = z.infer<
  typeof ConnectAccountingResponseSchema
>

export const ExpertInvoiceStatusSchema = z.enum([
  "pending",
  "issued",
  "failed",
  "manual_pending",
  "manual_issued",
])
export type ExpertInvoiceStatus = z.infer<typeof ExpertInvoiceStatusSchema>

export const ExpertInvoiceAdapterSchema = z.enum([
  "toconline",
  "moloni",
  "manual",
])
export type ExpertInvoiceAdapter = z.infer<typeof ExpertInvoiceAdapterSchema>

export const ExpertInvoiceSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  adapter: ExpertInvoiceAdapterSchema,
  status: ExpertInvoiceStatusSchema,
  amountCents: z.number().int().nonnegative(),
  number: z.string().nullable(),
  issuedAt: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  pdfUrl: z.string().nullable(),
})
export type ExpertInvoice = z.infer<typeof ExpertInvoiceSchema>

export const ListExpertInvoicesQuerySchema = z.object({
  status: ExpertInvoiceStatusSchema.optional(),
  cursor: z.string().uuid().optional(),
})
export type ListExpertInvoicesQuery = z.infer<
  typeof ListExpertInvoicesQuerySchema
>

export const ListExpertInvoicesResponseSchema = z.object({
  invoices: z.array(ExpertInvoiceSchema),
  nextCursor: z.string().uuid().nullable(),
})
export type ListExpertInvoicesResponse = z.infer<
  typeof ListExpertInvoicesResponseSchema
>

export const ExpertInvoiceActionRequestSchema = z.object({}).strict()
export type ExpertInvoiceActionRequest = z.infer<
  typeof ExpertInvoiceActionRequestSchema
>

export const ExpertInvoiceActionResponseSchema = ExpertInvoiceSchema
export type ExpertInvoiceActionResponse = z.infer<
  typeof ExpertInvoiceActionResponseSchema
>

export const SaftMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM")

export const ExportSaftQuerySchema = z.object({
  month: SaftMonthSchema,
})
export type ExportSaftQuery = z.infer<typeof ExportSaftQuerySchema>

export const ExportSaftResponseSchema = z.object({
  month: SaftMonthSchema,
  invoiceCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  expiresAt: z.string().datetime(),
  downloadUrl: z.string().url(),
})
export type ExportSaftResponse = z.infer<typeof ExportSaftResponseSchema>

export const ExportSaftFileQuerySchema = z.object({
  month: SaftMonthSchema,
  pathname: z.string().min(1).max(500),
  exp: z.coerce.number().int().positive(),
  sig: z.string().min(1).max(128),
})
export type ExportSaftFileQuery = z.infer<typeof ExportSaftFileQuerySchema>

export const AccountingReconciliationDetailsSchema = z.object({
  comparison: z.literal("expert_invoices"),
  issuanceGateClosed: z.literal(true),
  stripeGrossCents: z.number().int().nonnegative(),
  invoicedCents: z.number().int().nonnegative(),
  issuedExportCents: z.number().int().nonnegative(),
  missingInvoiceCount: z.number().int().nonnegative(),
  extraInvoiceCount: z.number().int().nonnegative(),
  amountMismatchCount: z.number().int().nonnegative(),
  failedInvoiceCount: z.number().int().nonnegative(),
  pendingInvoiceCount: z.number().int().nonnegative(),
  blockedInvoiceCount: z.number().int().nonnegative(),
  tier1Skipped: z.literal(true),
})

export const AccountingReconciliationRunSchema = z.object({
  id: z.string().uuid(),
  month: SaftMonthSchema,
  stripeFeeTotalCents: z.number().int().nonnegative(),
  invoicedTotalCents: z.number().int().nonnegative(),
  mismatchBps: z.number().int().nonnegative(),
  status: z.enum(["matched", "mismatch"]),
  details: AccountingReconciliationDetailsSchema,
  createdAt: z.string().datetime(),
})
export type AccountingReconciliationRun = z.infer<
  typeof AccountingReconciliationRunSchema
>

export const GetAccountingReconciliationQuerySchema = z.object({
  month: SaftMonthSchema.optional(),
})
export type GetAccountingReconciliationQuery = z.infer<
  typeof GetAccountingReconciliationQuerySchema
>

export const GetAccountingReconciliationResponseSchema = z.object({
  run: AccountingReconciliationRunSchema,
})
export type GetAccountingReconciliationResponse = z.infer<
  typeof GetAccountingReconciliationResponseSchema
>

export const PlatformFeeInvoiceStatusSchema = z.enum([
  "pending",
  "issued",
  "failed",
  "blocked",
  "skipped",
  "dead_lettered",
  "credited",
  "legacy",
  "legacy_missing",
])
export type PlatformFeeInvoiceStatus = z.infer<
  typeof PlatformFeeInvoiceStatusSchema
>

export const PlatformFeeIvaRegimeSchema = z.enum([
  "pending",
  "pt_territorial",
  "eu_reverse_charge",
  "eu_unclassified",
  "extra_eu_unclassified",
  "vies_unavailable",
])
export type PlatformFeeIvaRegime = z.infer<typeof PlatformFeeIvaRegimeSchema>

export const PlatformFeeAtStatusSchema = z.enum([
  "operator_gated",
  "not_applicable",
  "communicated",
  "failed",
])
export type PlatformFeeAtStatus = z.infer<typeof PlatformFeeAtStatusSchema>

export const PlatformFeeInvoiceSchema = z.object({
  id: z.string().uuid(),
  bookingPaymentId: z.string().uuid(),
  expertOrgId: z.string().uuid(),
  status: PlatformFeeInvoiceStatusSchema,
  ivaRegime: PlatformFeeIvaRegimeSchema,
  amountCents: z.number().int().nonnegative(),
  ivaRateBps: z.number().int().min(0).max(10_000),
  series: z.string().nullable(),
  number: z.string().nullable(),
  atStatus: PlatformFeeAtStatusSchema,
  issuedAt: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
})
export type PlatformFeeInvoice = z.infer<typeof PlatformFeeInvoiceSchema>

export const ListPlatformFeeInvoicesQuerySchema = z.object({
  month: SaftMonthSchema.optional(),
  status: PlatformFeeInvoiceStatusSchema.optional(),
  cursor: z.string().uuid().optional(),
})
export type ListPlatformFeeInvoicesQuery = z.infer<
  typeof ListPlatformFeeInvoicesQuerySchema
>

export const ListPlatformFeeInvoicesResponseSchema = z.object({
  month: SaftMonthSchema,
  invoices: z.array(PlatformFeeInvoiceSchema),
  nextCursor: z.string().uuid().nullable(),
})
export type ListPlatformFeeInvoicesResponse = z.infer<
  typeof ListPlatformFeeInvoicesResponseSchema
>

export const ClosedGateInvoiceEventTypeSchema = z.enum([
  "invoice.blocked",
  "invoice.skipped",
  "invoice.pending",
])
export type ClosedGateInvoiceEventType = z.infer<
  typeof ClosedGateInvoiceEventTypeSchema
>

export const ClosedGateInvoicePayloadSchema = z.object({
  invoiceKind: z.literal("platform_fee"),
  invoiceId: z.string().uuid(),
  bookingPaymentId: z.string().uuid(),
  expertOrgId: z.string().uuid(),
  status: z.enum(["blocked", "skipped", "pending"]),
  number: z.null(),
  pdfUrl: z.null(),
  error: z.string().nullable(),
})
export type ClosedGateInvoicePayload = z.infer<
  typeof ClosedGateInvoicePayloadSchema
>

export const ClosedGateInvoiceEventRefSchema = z.object({
  type: ClosedGateInvoiceEventTypeSchema,
  idempotencyKey: z.string().min(1),
})
export type ClosedGateInvoiceEventRef = z.infer<
  typeof ClosedGateInvoiceEventRefSchema
>

export const IssuePlatformFeeInvoiceRequestSchema = z.object({
  bookingPaymentId: z.string().uuid(),
})
export type IssuePlatformFeeInvoiceRequest = z.infer<
  typeof IssuePlatformFeeInvoiceRequestSchema
>

export const IssuePlatformFeeInvoiceResponseSchema = z.object({
  invoice: PlatformFeeInvoiceSchema.nullable(),
  outcome: z.enum(["skipped", "blocked", "pending", "already_recorded"]),
  reason: z.string().nullable(),
  domainEvent: ClosedGateInvoiceEventRefSchema.nullable(),
})
export type IssuePlatformFeeInvoiceResponse = z.infer<
  typeof IssuePlatformFeeInvoiceResponseSchema
>

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
  "practice",
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
  "practice",
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

// ── Expert practice / locations / multi-schedule (Phase 04B.1) ───────

const CountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase())

export const PatchPracticeRequestSchema = z.object({
  practiceCountry: CountryCodeSchema.optional(),
  serviceCountries: z.array(CountryCodeSchema).min(1).optional(),
  languages: z.array(z.string().min(2).max(16)).min(1).optional(),
  licenseScope: z.string().max(500).nullish(),
  worldwideRemote: z.boolean().optional(),
  acceptingBookings: z.boolean().optional(),
})
export type PatchPracticeRequest = z.infer<typeof PatchPracticeRequestSchema>

export const PracticeResponseSchema = z.object({
  practice: z.object({
    id: z.string().uuid(),
    practiceCountry: z.string(),
    serviceCountries: z.array(z.string()),
    languages: z.array(z.string()),
    licenseScope: z.string().nullable(),
    worldwideRemote: z.boolean(),
    acceptingBookings: z.boolean(),
  }),
})
export type PracticeResponse = z.infer<typeof PracticeResponseSchema>

export const CreatePracticeLocationRequestSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  line2: z.string().max(200).nullish(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).nullish(),
  country: CountryCodeSchema,
  postalCode: z.string().max(20).nullish(),
  timezone: z.string().nullish(),
  instructions: LocalizedTextSchema.nullish(),
  isPrimary: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
})
export type CreatePracticeLocationRequest = z.infer<
  typeof CreatePracticeLocationRequestSchema
>

export const PatchPracticeLocationRequestSchema =
  CreatePracticeLocationRequestSchema.partial().extend({
    active: z.boolean().optional(),
  })
export type PatchPracticeLocationRequest = z.infer<
  typeof PatchPracticeLocationRequestSchema
>

export const CreateNamedScheduleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string(),
  isDefault: z.boolean().optional(),
})
export type CreateNamedScheduleRequest = z.infer<
  typeof CreateNamedScheduleRequestSchema
>

export const PatchNamedScheduleRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  isDefault: z.boolean().optional(),
})
export type PatchNamedScheduleRequest = z.infer<
  typeof PatchNamedScheduleRequestSchema
>

export const PutScheduleRulesRequestSchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
})
export type PutScheduleRulesRequest = z.infer<
  typeof PutScheduleRulesRequestSchema
>

export const PutScheduleOverridesRequestSchema = z.object({
  overrides: z.array(
    z.object({
      overrideDate: z.string(),
      startTime: z.string().nullish(),
      endTime: z.string().nullish(),
      isBlocked: z.boolean(),
    })
  ),
})
export type PutScheduleOverridesRequest = z.infer<
  typeof PutScheduleOverridesRequestSchema
>

// ── Event Types ─────────────────────────────────────────────────────

export const EventTypeKindSchema = z.enum(["clinical", "non_clinical"])
export type EventTypeKind = z.infer<typeof EventTypeKindSchema>

export const EventTypeVisibilitySchema = z.enum([
  "public",
  "unlisted",
  "private",
])
export type EventTypeVisibility = z.infer<typeof EventTypeVisibilitySchema>

export const CreateEventTypeRequestSchema = z.object({
  slug: z.string().optional(),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.nullish(),
  durationMinutes: z.number().int().positive(),
  priceAmount: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  languages: z.array(z.string()),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  kind: EventTypeKindSchema.optional(),
  visibility: EventTypeVisibilitySchema.optional(),
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

export const BookingLinkStatusSchema = z.enum([
  "active",
  "used",
  "expired",
  "revoked",
])
export type BookingLinkStatus = z.infer<typeof BookingLinkStatusSchema>

export const CreateBookingLinkRequestSchema = z.object({
  eventTypeId: z.string().uuid(),
  eventTypeModeId: z.string().uuid().nullish(),
  scheduleId: z.string().uuid().nullish(),
  recipientEmail: z.string().email().max(320).nullish(),
  priceCents: z.number().int().nonnegative().nullish(),
  note: z.string().max(2000).nullish(),
  expiresAt: z.string().datetime(),
  maxUses: z.number().int().positive().max(100).default(1),
})
export type CreateBookingLinkRequest = z.infer<
  typeof CreateBookingLinkRequestSchema
>

export const BookingLinkListItemSchema = z.object({
  id: z.string().uuid(),
  eventTypeId: z.string().uuid(),
  eventTypeModeId: z.string().uuid().nullable(),
  scheduleId: z.string().uuid().nullable(),
  recipientEmail: z.string().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  note: z.string().nullable(),
  expiresAt: z.string().datetime(),
  maxUses: z.number().int().positive(),
  useCount: z.number().int().nonnegative(),
  status: BookingLinkStatusSchema,
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
})
export type BookingLinkListItem = z.infer<typeof BookingLinkListItemSchema>

export const CreateBookingLinkResponseSchema = z.object({
  id: z.string().uuid(),
  token: z.string().min(16),
  urlPath: z.string().min(1),
  link: BookingLinkListItemSchema,
})
export type CreateBookingLinkResponse = z.infer<
  typeof CreateBookingLinkResponseSchema
>

export const CreateEventTypeModeRequestSchema = z
  .object({
    mode: z.enum(["online", "phone", "in_person"]),
    locationId: z.string().uuid().nullish(),
    scheduleId: z.string().uuid(),
    priceCents: z.number().int().nonnegative().nullish(),
    currency: z.literal("EUR").nullish(),
    durationMinutes: z.number().int().positive().nullish(),
    countryScopeType: z.enum(["worldwide", "list"]),
    countryScopeCodes: z.array(CountryCodeSchema).default([]),
    languages: z.array(z.string().min(2).max(16)).min(1),
    label: z
      .object({
        en: z.string().min(1).max(200),
        pt: z.string().min(1).max(200).optional(),
        es: z.string().min(1).max(200).optional(),
      })
      .nullish(),
    sortOrder: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "in_person" && !value.locationId) {
      ctx.addIssue({
        code: "custom",
        message: "In-person modes need a practice location.",
        path: ["locationId"],
      })
    }
    if (value.mode !== "in_person" && value.locationId) {
      ctx.addIssue({
        code: "custom",
        message: "Only in-person modes may set a location.",
        path: ["locationId"],
      })
    }
    if (
      value.countryScopeType === "worldwide" &&
      value.countryScopeCodes.length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Worldwide scope cannot also list specific countries.",
        path: ["countryScopeCodes"],
      })
    }
    if (
      value.countryScopeType === "list" &&
      value.countryScopeCodes.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "List scope needs at least one country.",
        path: ["countryScopeCodes"],
      })
    }
    if ((value.priceCents == null) !== (value.currency == null)) {
      ctx.addIssue({
        code: "custom",
        message: "priceCents and currency must both be set or both omitted.",
        path: ["priceCents"],
      })
    }
  })

export type CreateEventTypeModeRequest = z.infer<
  typeof CreateEventTypeModeRequestSchema
>

export const PatchEventTypeModeRequestSchema = z
  .object({
    locationId: z.string().uuid().nullish(),
    scheduleId: z.string().uuid().optional(),
    priceCents: z.number().int().nonnegative().nullish(),
    currency: z.literal("EUR").nullish(),
    durationMinutes: z.number().int().positive().nullish(),
    countryScopeType: z.enum(["worldwide", "list"]).optional(),
    countryScopeCodes: z.array(CountryCodeSchema).optional(),
    languages: z.array(z.string().min(2).max(16)).min(1).optional(),
    label: z
      .object({
        en: z.string().min(1).max(200),
        pt: z.string().min(1).max(200).optional(),
        es: z.string().min(1).max(200).optional(),
      })
      .nullish(),
    sortOrder: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.countryScopeType === "worldwide" &&
      value.countryScopeCodes &&
      value.countryScopeCodes.length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Worldwide scope cannot also list specific countries.",
        path: ["countryScopeCodes"],
      })
    }
    if (
      value.countryScopeType === "list" &&
      value.countryScopeCodes &&
      value.countryScopeCodes.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "List scope needs at least one country.",
        path: ["countryScopeCodes"],
      })
    }
    if (
      value.priceCents !== undefined &&
      value.currency !== undefined &&
      (value.priceCents == null) !== (value.currency == null)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "priceCents and currency must both be set or both omitted.",
        path: ["priceCents"],
      })
    }
  })

export type PatchEventTypeModeRequest = z.infer<
  typeof PatchEventTypeModeRequestSchema
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

/**
 * Set or clear a destination override on an event type or mode.
 * Both fields null = inherit (mode → event type → expert default → ICS).
 * Both set = override; must be a connected calendar owned by the expert.
 */
export const EventTypeDestinationOverrideSchema = z
  .object({
    destinationIntegrationId: z.string().uuid().nullable(),
    destinationExternalCalendarId: z.string().min(1).max(512).nullable(),
  })
  .superRefine((value, ctx) => {
    const a = value.destinationIntegrationId == null
    const b = value.destinationExternalCalendarId == null
    if (a !== b) {
      ctx.addIssue({
        code: "custom",
        message:
          "destinationIntegrationId and destinationExternalCalendarId must both be set or both null.",
        path: ["destinationIntegrationId"],
      })
    }
  })

export type EventTypeDestinationOverride = z.infer<
  typeof EventTypeDestinationOverrideSchema
>

export const CalendarFeedTokenStatusSchema = z.object({
  hasToken: z.boolean(),
  createdAt: z.string().datetime().nullable(),
})

export type CalendarFeedTokenStatus = z.infer<
  typeof CalendarFeedTokenStatusSchema
>

export const RotateCalendarFeedTokenResponseSchema = z.object({
  token: z.string().min(16).max(128),
  createdAt: z.string().datetime(),
})

export type RotateCalendarFeedTokenResponse = z.infer<
  typeof RotateCalendarFeedTokenResponseSchema
>

export const ListExpertBookingsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type ListExpertBookingsQuery = z.infer<
  typeof ListExpertBookingsQuerySchema
>

export const ExpertBookingSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string(),
  sessionMode: z.enum(["online", "in_person", "phone"]),
  memberFirstName: z.string().nullable(),
  eventTypeTitle: z.object({
    en: z.string(),
    pt: z.string().optional(),
    es: z.string().optional(),
  }),
  eventTypeSlug: z.string(),
  modeLabel: z
    .object({
      en: z.string(),
      pt: z.string().optional(),
      es: z.string().optional(),
    })
    .nullable(),
  locationName: z.string().nullable(),
  locationCity: z.string().nullable(),
  locationCountry: z.string().nullable(),
  locationAddress: z.string().nullable(),
})

export type ExpertBooking = z.infer<typeof ExpertBookingSchema>

export const ListExpertBookingsResponseSchema = z.object({
  bookings: z.array(ExpertBookingSchema),
})

export type ListExpertBookingsResponse = z.infer<
  typeof ListExpertBookingsResponseSchema
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

export const BookingReminderKindSchema = z.enum([
  "booking.reminder_24h",
  "booking.reminder_1h",
])

export const BookingReminderRequestSchema = z.object({
  bookingId: z.string().uuid(),
  orgId: z.string().uuid(),
  kind: BookingReminderKindSchema,
  startsAt: z.string().datetime(),
})

export const BookingReminderResponseSchema = z.discriminatedUnion("status", [
  z.object({
    ok: z.literal(true),
    status: z.literal("sent"),
  }),
  z.object({
    ok: z.literal(true),
    status: z.literal("skipped"),
    reason: z.enum(["not_found", "not_active", "starts_at_mismatch"]),
  }),
])

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
export type BookingReminderRequest = z.infer<
  typeof BookingReminderRequestSchema
>
export type BookingReminderResponse = z.infer<
  typeof BookingReminderResponseSchema
>

export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9][0-9]{7,14}$/, "phoneE164 must be E.164")

export const VerifyPhoneStartRequestSchema = z.object({
  phoneE164: PhoneE164Schema,
})

export const VerifyPhoneStartResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("started"),
    phoneE164: PhoneE164Schema,
  }),
  z.object({
    status: z.literal("already_verified"),
    phoneE164: PhoneE164Schema,
  }),
])

export const VerifyPhoneConfirmRequestSchema = z.object({
  phoneE164: PhoneE164Schema,
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits"),
})

export const VerifyPhoneConfirmResponseSchema = z.object({
  status: z.literal("verified"),
  phoneE164: PhoneE164Schema,
})

export type VerifyPhoneStartRequest = z.infer<
  typeof VerifyPhoneStartRequestSchema
>
export type VerifyPhoneStartResponse = z.infer<
  typeof VerifyPhoneStartResponseSchema
>
export type VerifyPhoneConfirmRequest = z.infer<
  typeof VerifyPhoneConfirmRequestSchema
>
export type VerifyPhoneConfirmResponse = z.infer<
  typeof VerifyPhoneConfirmResponseSchema
>

export const InboxNotificationIdSchema = z.string().uuid()

export const InboxItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  href: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const ListInboxQuerySchema = z.object({
  unread: z
    .enum(["true", "1", "false", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const ListInboxResponseSchema = z.object({
  items: z.array(InboxItemSchema),
  unreadCount: z.number().int().nonnegative(),
})

export const MarkInboxReadResponseSchema = z.object({
  id: z.string().uuid(),
  readAt: z.string().datetime(),
})

export const MarkInboxReadAllResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
})

export type InboxItem = z.infer<typeof InboxItemSchema>
export type ListInboxQuery = z.infer<typeof ListInboxQuerySchema>
export type ListInboxResponse = z.infer<typeof ListInboxResponseSchema>
export type MarkInboxReadResponse = z.infer<typeof MarkInboxReadResponseSchema>
export type MarkInboxReadAllResponse = z.infer<
  typeof MarkInboxReadAllResponseSchema
>

// ---------------------------------------------------------------------------
// AI editor assist (ADR-023 / Phase 04B)
// ---------------------------------------------------------------------------

export const EditorAssistCommandSchema = z.enum([
  "improve",
  "shorten",
  "fix_grammar",
  "translate",
])

export const EditorAssistContextSchema = z.enum(["marketing", "clinical"])

export const EditorAssistResourceSchema = z.enum([
  "expert_profile",
  "event_type",
  "location",
])

export const EditorAssistRequestSchema = z
  .object({
    command: EditorAssistCommandSchema,
    text: z.string().min(1).max(20_000),
    sourceLocale: LocaleSchema.optional(),
    targetLocale: LocaleSchema.optional(),
    context: EditorAssistContextSchema.default("marketing"),
    resource: EditorAssistResourceSchema,
    resourceId: z.string().uuid(),
  })
  .superRefine((value, ctx) => {
    if (value.command === "translate") {
      if (!value.sourceLocale) {
        ctx.addIssue({
          code: "custom",
          message: "sourceLocale is required for translate",
          path: ["sourceLocale"],
        })
      }
      if (!value.targetLocale) {
        ctx.addIssue({
          code: "custom",
          message: "targetLocale is required for translate",
          path: ["targetLocale"],
        })
      }
    }
  })

export type EditorAssistCommand = z.infer<typeof EditorAssistCommandSchema>
export type EditorAssistContext = z.infer<typeof EditorAssistContextSchema>
export type EditorAssistResource = z.infer<typeof EditorAssistResourceSchema>
export type EditorAssistRequest = z.infer<typeof EditorAssistRequestSchema>

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

  async function requestStream(
    method: string,
    path: string,
    body?: unknown
  ): Promise<Response> {
    const url = `${baseUrl.replace(/\/$/, "")}${path}`
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "text/plain",
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

    if (!response.ok) {
      const text = await response.text()
      let error: ApiError
      try {
        error = JSON.parse(text) as ApiError
      } catch {
        error = { error: "unknown", message: text || `HTTP ${response.status}` }
      }
      throw new ApiClientError(response.status, error)
    }

    return response
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
      async verifyPhoneStart(data: VerifyPhoneStartRequest) {
        const raw = await request<unknown>(
          "POST",
          "/me/phone/verify-start",
          data
        )
        return VerifyPhoneStartResponseSchema.parse(raw)
      },
      async verifyPhoneConfirm(data: VerifyPhoneConfirmRequest) {
        const raw = await request<unknown>(
          "POST",
          "/me/phone/verify-confirm",
          data
        )
        return VerifyPhoneConfirmResponseSchema.parse(raw)
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

    /** Singular authenticated `/expert/*` surface (Phase 04B). Public reads stay under `/public/experts/*`. */
    expert: {
      profile: {
        ensure(data: EnsureExpertProfileRequest) {
          return request<EnsureExpertProfileResponse>(
            "POST",
            "/expert/profile/ensure",
            data
          )
        },
        patch(data: PatchExpertProfileRequest) {
          return request<{ ok: true }>("PATCH", "/expert/profile", data)
        },
        completeStep(step: string) {
          return request<{ ok: true }>(
            "POST",
            `/expert/profile/steps/${encodeURIComponent(step)}/complete`
          )
        },
        setInvoicing(data: InvoicingRequest) {
          return request<{ ok: true }>("PUT", "/expert/profile/invoicing", data)
        },
      },
      schedule: {
        get() {
          return request<{ schedule: unknown }>("GET", "/expert/schedule")
        },
        save(data: SaveScheduleRequest) {
          return request<{ ok: true }>("PUT", "/expert/schedule", data)
        },
        addOverride(data: DateOverrideRequest) {
          return request<{ ok: true }>(
            "POST",
            "/expert/schedule/overrides",
            data
          )
        },
        removeOverride(overrideId: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/expert/schedule/overrides/${encodeURIComponent(overrideId)}`
          )
        },
      },
      eventTypes: {
        create(data: CreateEventTypeRequest) {
          return request<{ ok: true; id: string }>(
            "POST",
            "/expert/event-types",
            data
          )
        },
        update(id: string, data: UpdateEventTypeRequest) {
          return request<{ ok: true }>(
            "PATCH",
            `/expert/event-types/${encodeURIComponent(id)}`,
            data
          )
        },
        publish(id: string) {
          return request<{ ok: true }>(
            "POST",
            `/expert/event-types/${encodeURIComponent(id)}/publish`
          )
        },
        unpublish(id: string) {
          return request<{ ok: true }>(
            "POST",
            `/expert/event-types/${encodeURIComponent(id)}/unpublish`
          )
        },
        remove(id: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/expert/event-types/${encodeURIComponent(id)}`
          )
        },
        listModes(id: string, includeInactive = false) {
          const qs = includeInactive ? "?includeInactive=true" : ""
          return request<{ modes: unknown[] }>(
            "GET",
            `/expert/event-types/${encodeURIComponent(id)}/modes${qs}`
          )
        },
        createMode(id: string, data: CreateEventTypeModeRequest) {
          return request<{ mode: unknown }>(
            "POST",
            `/expert/event-types/${encodeURIComponent(id)}/modes`,
            data
          )
        },
        getMode(id: string, modeId: string) {
          return request<{ mode: unknown }>(
            "GET",
            `/expert/event-types/${encodeURIComponent(id)}/modes/${encodeURIComponent(modeId)}`
          )
        },
        patchMode(id: string, modeId: string, data: PatchEventTypeModeRequest) {
          return request<{ mode: unknown }>(
            "PATCH",
            `/expert/event-types/${encodeURIComponent(id)}/modes/${encodeURIComponent(modeId)}`,
            data
          )
        },
        removeMode(id: string, modeId: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/expert/event-types/${encodeURIComponent(id)}/modes/${encodeURIComponent(modeId)}`
          )
        },
        setDestination(id: string, data: EventTypeDestinationOverride) {
          return request<{
            ok: true
            destination: EventTypeDestinationOverride
          }>(
            "PATCH",
            `/expert/event-types/${encodeURIComponent(id)}/destination`,
            data
          )
        },
        setModeDestination(
          id: string,
          modeId: string,
          data: EventTypeDestinationOverride
        ) {
          return request<{
            ok: true
            destination: EventTypeDestinationOverride
          }>(
            "PATCH",
            `/expert/event-types/${encodeURIComponent(id)}/modes/${encodeURIComponent(modeId)}/destination`,
            data
          )
        },
      },
      bookingLinks: {
        list(eventTypeId: string) {
          const qs = new URLSearchParams({ eventTypeId })
          return request<{ links: BookingLinkListItem[] }>(
            "GET",
            `/expert/booking-links?${qs.toString()}`
          )
        },
        create(data: CreateBookingLinkRequest) {
          return request<CreateBookingLinkResponse>(
            "POST",
            "/expert/booking-links",
            data
          )
        },
        revoke(id: string) {
          return request<{ ok: true; link: BookingLinkListItem }>(
            "POST",
            `/expert/booking-links/${encodeURIComponent(id)}/revoke`
          )
        },
      },
      integrations: {
        disconnect(integrationId: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/expert/integrations/${encodeURIComponent(integrationId)}`
          )
        },
        listCalendars(integrationId: string) {
          return request<{ calendars: SubCalendar[] }>(
            "GET",
            `/expert/integrations/${encodeURIComponent(integrationId)}/calendars`
          )
        },
        setBusySources(integrationId: string, data: BusySourcesRequest) {
          return request<{ ok: true }>(
            "PUT",
            `/expert/integrations/${encodeURIComponent(integrationId)}/busy-sources`,
            data
          )
        },
        setDestination(
          integrationId: string,
          data: DestinationCalendarRequest
        ) {
          return request<{ ok: true }>(
            "PUT",
            `/expert/integrations/${encodeURIComponent(integrationId)}/destination`,
            data
          )
        },
      },
      bookings: {
        list(query: ListExpertBookingsQuery) {
          const qs = new URLSearchParams({
            from: query.from,
            to: query.to,
          })
          return request<ListExpertBookingsResponse>(
            "GET",
            `/expert/bookings?${qs.toString()}`
          ).then((raw) => ListExpertBookingsResponseSchema.parse(raw))
        },
      },
      calendar: {
        getFeedTokenStatus() {
          return request<CalendarFeedTokenStatus>(
            "GET",
            "/expert/calendar/feed-token"
          ).then((raw) => CalendarFeedTokenStatusSchema.parse(raw))
        },
        rotateFeedToken() {
          return request<RotateCalendarFeedTokenResponse>(
            "POST",
            "/expert/calendar/feed-token"
          ).then((raw) => RotateCalendarFeedTokenResponseSchema.parse(raw))
        },
        revokeFeedToken() {
          return request<{ ok: true }>("DELETE", "/expert/calendar/feed-token")
        },
      },

      practice: {
        get() {
          return request<PracticeResponse>("GET", "/expert/practice")
        },
        patch(data: PatchPracticeRequest) {
          return request<PracticeResponse>("PATCH", "/expert/practice", data)
        },
      },
      locations: {
        list(includeInactive = false) {
          const qs = includeInactive ? "?includeInactive=true" : ""
          return request<{ locations: unknown[] }>(
            "GET",
            `/expert/locations${qs}`
          )
        },
        create(data: CreatePracticeLocationRequest) {
          return request<{ location: unknown }>(
            "POST",
            "/expert/locations",
            data
          )
        },
        get(id: string) {
          return request<{ location: unknown }>(
            "GET",
            `/expert/locations/${encodeURIComponent(id)}`
          )
        },
        patch(id: string, data: PatchPracticeLocationRequest) {
          return request<{ location: unknown }>(
            "PATCH",
            `/expert/locations/${encodeURIComponent(id)}`,
            data
          )
        },
        remove(id: string) {
          return request<{ location: unknown; archived: true }>(
            "DELETE",
            `/expert/locations/${encodeURIComponent(id)}`
          )
        },
      },
      schedules: {
        list() {
          return request<{ schedules: unknown[] }>("GET", "/expert/schedules")
        },
        create(data: CreateNamedScheduleRequest) {
          return request<{ schedule: unknown }>(
            "POST",
            "/expert/schedules",
            data
          )
        },
        get(id: string) {
          return request<{ schedule: unknown }>(
            "GET",
            `/expert/schedules/${encodeURIComponent(id)}`
          )
        },
        patch(id: string, data: PatchNamedScheduleRequest) {
          return request<{ schedule: unknown }>(
            "PATCH",
            `/expert/schedules/${encodeURIComponent(id)}`,
            data
          )
        },
        remove(id: string) {
          return request<{ ok: true }>(
            "DELETE",
            `/expert/schedules/${encodeURIComponent(id)}`
          )
        },
        putRules(id: string, data: PutScheduleRulesRequest) {
          return request<{ rules: unknown[] }>(
            "PUT",
            `/expert/schedules/${encodeURIComponent(id)}/rules`,
            data
          )
        },
        putOverrides(id: string, data: PutScheduleOverridesRequest) {
          return request<{ overrides: unknown[] }>(
            "PUT",
            `/expert/schedules/${encodeURIComponent(id)}/overrides`,
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

    accounting: {
      async connect(provider: ConnectAccountingProvider) {
        const raw = await request<unknown>(
          "POST",
          `/accounting/connect/${encodeURIComponent(provider)}`
        )
        return ConnectAccountingResponseSchema.parse(raw)
      },
      async reconciliation(query: GetAccountingReconciliationQuery = {}) {
        const params = new URLSearchParams()
        if (query.month) params.set("month", query.month)
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          qs ? `/accounting/reconciliation?${qs}` : "/accounting/reconciliation"
        )
        return GetAccountingReconciliationResponseSchema.parse(raw)
      },
    },

    invoicing: {
      async listPlatformFee(query: ListPlatformFeeInvoicesQuery = {}) {
        const params = new URLSearchParams()
        if (query.month) params.set("month", query.month)
        if (query.status) params.set("status", query.status)
        if (query.cursor) params.set("cursor", query.cursor)
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          qs ? `/invoicing/platform-fee?${qs}` : "/invoicing/platform-fee"
        )
        return ListPlatformFeeInvoicesResponseSchema.parse(raw)
      },
      async issuePlatformFee(data: IssuePlatformFeeInvoiceRequest) {
        const raw = await request<unknown>(
          "POST",
          "/invoicing/platform-fee",
          data
        )
        return IssuePlatformFeeInvoiceResponseSchema.parse(raw)
      },
      async listExpert(query: ListExpertInvoicesQuery = {}) {
        const params = new URLSearchParams()
        if (query.status) params.set("status", query.status)
        if (query.cursor) params.set("cursor", query.cursor)
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          qs ? `/invoicing/expert?${qs}` : "/invoicing/expert"
        )
        return ListExpertInvoicesResponseSchema.parse(raw)
      },
      async retryExpert(
        bookingId: string,
        data: ExpertInvoiceActionRequest = {}
      ) {
        const raw = await request<unknown>(
          "POST",
          `/invoicing/expert/${encodeURIComponent(bookingId)}/retry`,
          data
        )
        return ExpertInvoiceActionResponseSchema.parse(raw)
      },
      async markExpertManual(
        bookingId: string,
        data: ExpertInvoiceActionRequest = {}
      ) {
        const raw = await request<unknown>(
          "POST",
          `/invoicing/expert/${encodeURIComponent(bookingId)}/mark-manual`,
          data
        )
        return ExpertInvoiceActionResponseSchema.parse(raw)
      },
      async exportSaft(query: ExportSaftQuery) {
        const params = new URLSearchParams({ month: query.month })
        const raw = await request<unknown>(
          "GET",
          `/invoicing/exports/saft?${params.toString()}`
        )
        return ExportSaftResponseSchema.parse(raw)
      },
    },

    notifications: {
      async list(query?: { unread?: boolean; limit?: number }) {
        const params = new URLSearchParams()
        if (query?.unread) params.set("unread", "true")
        if (query?.limit != null) params.set("limit", String(query.limit))
        const qs = params.toString()
        const raw = await request<unknown>(
          "GET",
          `/notifications${qs ? `?${qs}` : ""}`
        )
        return ListInboxResponseSchema.parse(raw)
      },
      async markRead(notificationId: string) {
        const raw = await request<unknown>(
          "POST",
          `/notifications/${encodeURIComponent(notificationId)}/read`
        )
        return MarkInboxReadResponseSchema.parse(raw)
      },
      async markReadAll() {
        const raw = await request<unknown>("POST", "/notifications/read-all")
        return MarkInboxReadAllResponseSchema.parse(raw)
      },
    },

    workflows: {
      async bookingReminder(data: BookingReminderRequest) {
        const raw = await request<unknown>(
          "POST",
          "/workflows/booking-reminder",
          data
        )
        return BookingReminderResponseSchema.parse(raw)
      },
    },

    ai: {
      /**
       * Streams plain-text editor assist. Caller consumes `response.body`.
       * Errors before the stream starts throw `ApiClientError`.
       */
      editorAssist(data: EditorAssistRequest) {
        return requestStream("POST", "/ai/editor", data)
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
