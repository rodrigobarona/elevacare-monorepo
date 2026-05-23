import { createDocument } from "zod-openapi"
import { z } from "zod"
import {
  BillingCheckoutRequestSchema,
  BillingCheckoutResponseSchema,
  BillingPortalRequestSchema,
  BillingPortalResponseSchema,
  BillingSubscribeRequestSchema,
  BillingSubscribeResponseSchema,
  CreateAccountSessionRequestSchema,
  CreateAccountSessionResponseSchema,
  CreateIdentitySessionResponseSchema,
  SyncExistingOnboardingResponseSchema,
  CreateOrganizationRequestSchema,
  CreateOrganizationResponseSchema,
  CreateWorkspaceRequestSchema,
  ExpertOnboardingStepSchema,
  ListOrganizationsMineResponseSchema,
} from "@eleva/api-client"

const ErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
  message: z.string().optional(),
})

// `/webhooks/stripe` returns this richer payload on retryable handler
// failures so operators can correlate Stripe redelivery attempts with the
// original event id and dispatcher reason.
const StripeWebhookErrorSchema = z.object({
  received: z.literal(false),
  status: z.literal("failed"),
  eventType: z.string(),
  error: z.string(),
})

const RateLimitErrorSchema = z.object({
  error: z.literal("rate_limit_exceeded"),
  retryAfter: z.number(),
})

const OkSchema = z.object({ ok: z.literal(true) })

const LocalizedTextSchema = z.object({
  en: z.string(),
  pt: z.string().optional(),
  es: z.string().optional(),
})

const stdErrors = {
  "401": {
    description: "Unauthorized",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "422": {
    description: "Validation error",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "429": {
    description: "Rate limit exceeded",
    content: { "application/json": { schema: RateLimitErrorSchema } },
  },
} as const

const stdWithNotFound = {
  ...stdErrors,
  "404": {
    description: "Not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const

export function generateOpenApiSpec(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Eleva Care API",
      version: "1.0.0",
      description:
        "API-first platform for Eleva Care. Supports session-based auth (browser) and Bearer token auth (AI agents, M2M).",
    },
    servers: [
      {
        url: "https://api.eleva.care",
        description: "Production",
      },
      {
        url: "http://localhost:3002",
        description: "Local development",
      },
    ],
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    paths: {
      "/onboarding/complete": {
        post: {
          operationId: "completeOnboarding",
          summary: "Complete user onboarding",
          description:
            "Creates a WorkOS organization, membership, and provisions user/org/membership rows in the Eleva DB. Protected by BotID on browser sessions.",
          tags: ["Onboarding"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  spaceName: z.string().min(2).max(100),
                  locale: z.string().min(2).max(10).optional(),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Onboarding completed successfully",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    userId: z.string().uuid(),
                    orgId: z.string().uuid(),
                    slug: z.string(),
                  }),
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "403": {
              description: "Forbidden (bot detected or missing capability)",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "422": {
              description: "Validation error",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              content: {
                "application/json": { schema: RateLimitErrorSchema },
              },
            },
          },
        },
      },
      "/onboarding/sync-existing": {
        post: {
          operationId: "syncExistingOnboardingMembership",
          summary: "Sync an existing WorkOS membership into Eleva",
          description:
            "Used by account onboarding when a user already has a WorkOS organization membership. Provisions local user/org/membership mirrors through the API boundary.",
          tags: ["Onboarding"],
          responses: {
            "200": {
              description: "Existing membership sync result",
              content: {
                "application/json": {
                  schema: SyncExistingOnboardingResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/organizations": {
        post: {
          operationId: "createOrganization",
          summary: "Create an organization",
          tags: ["Organizations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CreateOrganizationRequestSchema,
              },
            },
          },
          responses: {
            "201": {
              description: "Organization created",
              content: {
                "application/json": {
                  schema: CreateOrganizationResponseSchema,
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "422": {
              description: "Validation error",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              content: {
                "application/json": { schema: RateLimitErrorSchema },
              },
            },
          },
        },
        get: {
          operationId: "getOrganizationBySlug",
          summary: "Get organization by slug",
          tags: ["Organizations"],
          parameters: [
            {
              name: "slug",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Organization found",
              content: {
                "application/json": {
                  schema: z.object({
                    id: z.string().uuid(),
                    workosOrgId: z.string(),
                    slug: z.string().nullable(),
                    type: z.string(),
                  }),
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
          },
        },
      },
      "/organizations/mine": {
        get: {
          operationId: "listMyOrganizations",
          summary: "List current user's workspaces",
          description:
            "Returns all organizations the authenticated user belongs to, enriched for the workspace switcher UI and agent clients.",
          tags: ["Organizations"],
          responses: {
            "200": {
              description: "Workspace list",
              content: {
                "application/json": {
                  schema: ListOrganizationsMineResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/memberships": {
        post: {
          operationId: "createMembership",
          summary: "Create a membership",
          tags: ["Memberships"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  userId: z.string().uuid(),
                  orgId: z.string().uuid(),
                  role: z.enum(["admin", "member"]).default("member"),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Membership created",
              content: {
                "application/json": {
                  schema: z.object({ ok: z.literal(true) }),
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
            "422": {
              description: "Validation error",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
          },
        },
      },
      "/users/avatar": {
        get: {
          operationId: "getAvatar",
          summary: "Get current user avatar URL",
          tags: ["Users"],
          responses: {
            "200": {
              description: "Avatar URL",
              content: {
                "application/json": {
                  schema: z.object({ avatarUrl: z.string().nullable() }),
                },
              },
            },
            ...stdErrors,
          },
        },
        put: {
          operationId: "updateAvatar",
          summary: "Set user avatar URL",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({ url: z.string().url() }),
              },
            },
          },
          responses: {
            "200": {
              description: "Avatar updated",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdErrors,
          },
        },
        delete: {
          operationId: "removeAvatar",
          summary: "Remove user avatar",
          tags: ["Users"],
          responses: {
            "200": {
              description: "Avatar removed",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/experts/profile": {
        patch: {
          operationId: "patchExpertProfile",
          summary: "Update expert profile fields",
          tags: ["Expert Profile"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  nif: z.string().nullish(),
                  licenseScope: z.string().nullish(),
                  languages: z.array(z.string()).optional(),
                  practiceCountries: z.array(z.string()).optional(),
                  worldwideMode: z.boolean().optional(),
                  sessionModes: z
                    .array(z.enum(["online", "in_person", "phone"]))
                    .optional(),
                  displayName: z.string().min(1).optional(),
                  headline: z.string().nullish(),
                  bio: z.string().nullish(),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Profile updated",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/profile/ensure": {
        post: {
          operationId: "ensureExpertProfile",
          summary: "Create expert profile if missing for the active org",
          tags: ["Expert Profile"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  orgSlug: z.string().min(1).max(30),
                  displayName: z.string().min(1).max(200),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Profile ensured",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    profile: z.object({
                      id: z.string().uuid(),
                      orgId: z.string().uuid(),
                      userId: z.string().uuid(),
                      username: z.string(),
                      displayName: z.string(),
                      status: z.string(),
                      metadata: z
                        .record(z.string(), z.unknown())
                        .nullable()
                        .optional(),
                    }),
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/profile/steps/{step}/complete": {
        post: {
          operationId: "completeOnboardingStep",
          summary: "Mark an onboarding step as complete",
          tags: ["Expert Profile"],
          parameters: [
            {
              name: "step",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [...ExpertOnboardingStepSchema.options],
              },
            },
          ],
          responses: {
            "200": {
              description: "Step completed",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/profile/invoicing": {
        put: {
          operationId: "setInvoicingChoice",
          summary: "Set expert invoicing provider",
          tags: ["Expert Profile"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  provider: z.enum(["toconline", "moloni", "manual"]),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Invoicing choice saved",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/schedule": {
        get: {
          operationId: "getSchedule",
          summary: "Get expert schedule with rules and overrides",
          tags: ["Expert Schedule"],
          responses: {
            "200": {
              description: "Schedule data",
              content: {
                "application/json": {
                  schema: z.object({ schedule: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        put: {
          operationId: "saveSchedule",
          summary: "Save full schedule (timezone + availability rules)",
          tags: ["Expert Schedule"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  timezone: z.string(),
                  rules: z.array(
                    z.object({
                      dayOfWeek: z.number().int().min(0).max(6),
                      startTime: z.string(),
                      endTime: z.string(),
                    })
                  ),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Schedule saved",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/schedule/overrides": {
        post: {
          operationId: "addDateOverride",
          summary: "Add or update a date override",
          tags: ["Expert Schedule"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  overrideDate: z.string(),
                  startTime: z.string().optional(),
                  endTime: z.string().optional(),
                  isBlocked: z.boolean(),
                  timezone: z.string(),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Override created/updated",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/schedule/overrides/{id}": {
        delete: {
          operationId: "removeDateOverride",
          summary: "Delete a date override",
          tags: ["Expert Schedule"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Override removed",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/event-types": {
        post: {
          operationId: "createEventType",
          summary: "Create an event type",
          tags: ["Expert Event Types"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
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
                  cancellationWindowHours: z
                    .number()
                    .int()
                    .positive()
                    .nullish(),
                  rescheduleWindowHours: z.number().int().positive().nullish(),
                  requiresApproval: z.boolean(),
                  worldwideMode: z.boolean(),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Event type created",
              content: {
                "application/json": {
                  schema: z.object({ ok: z.literal(true), id: z.string() }),
                },
              },
            },
            "409": {
              description: "Slug conflict",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/event-types/{id}": {
        patch: {
          operationId: "updateEventType",
          summary: "Update an event type",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  slug: z.string().optional(),
                  title: LocalizedTextSchema.optional(),
                  description: LocalizedTextSchema.nullish(),
                  published: z.boolean().optional(),
                  durationMinutes: z.number().int().positive().optional(),
                  priceAmount: z.number().nonnegative().optional(),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Event type updated",
              content: { "application/json": { schema: OkSchema } },
            },
            "409": {
              description: "Slug conflict",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
        delete: {
          operationId: "deleteEventType",
          summary: "Soft-delete an event type",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Event type deleted",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/event-types/{id}/publish": {
        patch: {
          operationId: "toggleEventTypePublish",
          summary: "Toggle event type published state",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({ published: z.boolean() }),
              },
            },
          },
          responses: {
            "200": {
              description: "Publish state toggled",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/integrations/{id}": {
        delete: {
          operationId: "disconnectIntegration",
          summary: "Disconnect a calendar integration",
          tags: ["Expert Calendars"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Integration disconnected",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/integrations/{id}/calendars": {
        get: {
          operationId: "listSubCalendars",
          summary: "List sub-calendars from external provider",
          tags: ["Expert Calendars"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Sub-calendar list",
              content: {
                "application/json": {
                  schema: z.object({
                    calendars: z.array(
                      z.object({
                        id: z.string(),
                        name: z.string(),
                        primary: z.boolean(),
                        email: z.string().optional(),
                      })
                    ),
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/integrations/{id}/busy-sources": {
        put: {
          operationId: "setBusySources",
          summary: "Replace busy calendar sources",
          tags: ["Expert Calendars"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  sources: z.array(
                    z.object({
                      externalCalendarId: z.string(),
                      displayName: z.string(),
                    })
                  ),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Busy sources updated",
              content: { "application/json": { schema: OkSchema } },
            },
            "403": {
              description: "Calendar not owned by this account",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/experts/integrations/{id}/destination": {
        put: {
          operationId: "setDestinationCalendar",
          summary: "Set destination calendar for new bookings",
          tags: ["Expert Calendars"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({ externalCalendarId: z.string() }),
              },
            },
          },
          responses: {
            "200": {
              description: "Destination calendar set",
              content: { "application/json": { schema: OkSchema } },
            },
            "403": {
              description: "Calendar not owned by this account",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/billing/checkout": {
        post: {
          operationId: "createBillingCheckoutSession",
          summary: "Create an embedded subscription Checkout Session",
          description:
            "Creates a Stripe Checkout Session with ui_mode=embedded for the authenticated user's current organization.",
          tags: ["Billing"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: BillingCheckoutRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Checkout Session created",
              content: {
                "application/json": { schema: BillingCheckoutResponseSchema },
              },
            },
            "403": {
              description: "Missing billing management capability",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description:
                "Org has no Stripe Customer; run provisioning backfill",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/billing/portal": {
        post: {
          operationId: "createBillingPortalSession",
          summary: "Create a Stripe Customer Portal session",
          description:
            "Mints a Stripe Customer Portal session and audits the mint for multi-admin billing attribution.",
          tags: ["Billing"],
          requestBody: {
            required: false,
            content: {
              "application/json": { schema: BillingPortalRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Portal session created",
              content: {
                "application/json": { schema: BillingPortalResponseSchema },
              },
            },
            "403": {
              description: "Missing billing management capability",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description:
                "Org has no Stripe Customer; run provisioning backfill",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/billing/subscribe": {
        post: {
          operationId: "billingSubscribe",
          summary: "Create or upgrade an org subscription",
          description:
            "Compatibility endpoint for the legacy Payment Element subscription flow. Prefer POST /billing/checkout for new clients.",
          tags: ["Billing"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: BillingSubscribeRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Subscription created or updated",
              content: {
                "application/json": { schema: BillingSubscribeResponseSchema },
              },
            },
            "403": {
              description: "Missing billing:manage_org capability",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "404": {
              description: "Tier not found in Stripe (run seed-products)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description:
                "Org has no Stripe Customer; run provisioning backfill",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/stripe/identity": {
        post: {
          operationId: "createIdentitySession",
          summary: "Create a Stripe Identity verification session",
          description:
            "Creates a Stripe Identity verification session for the authenticated expert. Returns the client_secret to mount the embedded Identity modal. Webhook updates `expert_profiles.stripe_identity_status`.",
          tags: ["Stripe"],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: z.object({}).passthrough(),
              },
            },
          },
          responses: {
            "200": {
              description: "Identity session created",
              content: {
                "application/json": {
                  schema: CreateIdentitySessionResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing expert:onboard capability",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "404": {
              description: "No expert profile for this user",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/stripe/account-session": {
        post: {
          operationId: "createAccountSession",
          summary: "Mint a Stripe Connect AccountSession",
          description:
            "Mints a short-lived Stripe Connect AccountSession scoped to a per-page allow-list of components. The returned client_secret is consumed by `@stripe/connect-js` + `@stripe/react-connect-js` to render embedded Connect components.",
          tags: ["Stripe"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CreateAccountSessionRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "AccountSession minted",
              content: {
                "application/json": {
                  schema: CreateAccountSessionResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing payouts:view_own capability",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "404": {
              description: "No expert profile for this user",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Expert has no Connect account linked",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/webhooks/stripe": {
        post: {
          operationId: "stripeWebhook",
          summary: "Stripe webhook receiver",
          description:
            "Stripe-signed webhook receiver. Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` and dispatches the event through `processStripeEvent`. Persists each `event.id` in `stripe_webhook_events` for idempotency. Returns 200 for processed/ignored/duplicate, 500 only for retryable handler failures (so Stripe redelivers).",
          tags: ["Webhooks"],
          security: [],
          parameters: [
            {
              name: "stripe-signature",
              in: "header",
              required: true,
              description: "Stripe signature header (`v1=...,t=...`).",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            description: "Raw Stripe event body.",
            content: {
              "application/json": {
                schema: z.object({}).passthrough(),
              },
            },
          },
          responses: {
            "200": {
              description: "Event accepted (processed | ignored | duplicate)",
              content: {
                "application/json": {
                  schema: z.object({
                    received: z.literal(true),
                    status: z.enum(["processed", "ignored", "duplicate"]),
                    eventType: z.string().optional(),
                  }),
                },
              },
            },
            "400": {
              description: "Missing or invalid signature",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description:
                "Handler returned a retryable error; Stripe will retry with exponential backoff",
              content: {
                "application/json": { schema: StripeWebhookErrorSchema },
              },
            },
          },
        },
      },
      "/health": {
        get: {
          operationId: "healthCheck",
          summary: "Health check",
          tags: ["System"],
          security: [],
          responses: {
            "200": {
              description: "Service healthy",
              content: {
                "application/json": {
                  schema: z.object({ status: z.literal("ok") }),
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API key (elk_ prefix) or M2M JWT token for agent/service auth",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "wos-session",
          description: "WorkOS AuthKit session cookie for browser auth",
        },
      },
    },
  })
}
