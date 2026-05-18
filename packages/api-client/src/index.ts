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

    const json = await response.json()

    if (!response.ok) {
      throw new ApiClientError(response.status, json as ApiError)
    }

    return json as T
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
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
