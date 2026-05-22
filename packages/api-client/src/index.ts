import { z } from "zod"
import { LocaleSchema } from "@eleva/config/i18n"

// ---------------------------------------------------------------------------
// Shared Zod schemas (used by both client and server)
// ---------------------------------------------------------------------------

export const CompleteOnboardingRequestSchema = z.object({
  spaceName: z.string().min(2).max(100).trim(),
  locale: LocaleSchema.optional(),
})

export const SyncExistingOnboardingRequestSchema = z
  .object({
    locale: LocaleSchema.optional(),
  })
  .optional()

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
  workosOrgId: z.string(),
  orgId: z.string().uuid(),
  orgSlug: z.string(),
  orgType: OrgTypeSchema,
  name: z.string(),
  workosRole: z.enum(["admin", "member"]),
  productLabel: z.string(),
  isCurrent: z.boolean(),
})

export const ListOrganizationsMineResponseSchema = z.object({
  organizations: z.array(OrganizationSwitcherItemSchema),
})

export const CreateOrganizationResponseSchema = z.object({
  orgId: z.string().uuid(),
  slug: z.string(),
  workosOrgId: z.string(),
  created: z.boolean(),
})

export const GetOrganizationResponseSchema = z.object({
  id: z.string().uuid(),
  workosOrgId: z.string(),
  slug: z.string().nullable(),
  type: z.string(),
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
export type CreateIdentitySessionResponse = z.infer<
  typeof CreateIdentitySessionResponseSchema
>
export type ApiError = z.infer<typeof ApiErrorSchema>

// ── Avatar ──────────────────────────────────────────────────────────

export const UpdateAvatarRequestSchema = z.object({
  url: z.string().url(),
})

export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequestSchema>

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
  priceAmount: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
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
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
