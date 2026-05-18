import { z } from "zod"

// ---------------------------------------------------------------------------
// Shared Zod schemas (used by both client and server)
// ---------------------------------------------------------------------------

export const CompleteOnboardingRequestSchema = z.object({
  spaceName: z.string().min(2).max(100).trim(),
  locale: z.string().min(2).max(10).optional(),
})

export const CompleteOnboardingResponseSchema = z.object({
  ok: z.literal(true),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  slug: z.string(),
})

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  type: z.enum(["personal", "expert", "team", "staff"]).default("personal"),
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

export const ApiErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
  message: z.string().optional(),
  retryAfter: z.number().optional(),
})

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>
export type CompleteOnboardingResponse = z.infer<
  typeof CompleteOnboardingResponseSchema
>
export type CreateOrganizationRequest = z.infer<
  typeof CreateOrganizationRequestSchema
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
    },

    organizations: {
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
