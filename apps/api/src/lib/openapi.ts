import { createDocument, type ZodOpenApiPathItemObject } from "zod-openapi"
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
  CreateConnectAccountRequestSchema,
  CreateConnectAccountResponseSchema,
  CreateIdentitySessionResponseSchema,
  SyncExistingOnboardingResponseSchema,
  CreateEventTypeRequestSchema,
  PatchExpertProfileRequestSchema,
  UpdateEventTypeRequestSchema,
  CreateEventTypeModeRequestSchema,
  PatchEventTypeModeRequestSchema,
  EventTypeDestinationOverrideSchema,
  CreateBookingLinkRequestSchema,
  BookingLinkListItemSchema,
  CreateBookingLinkResponseSchema,
  CalendarFeedTokenStatusSchema,
  RotateCalendarFeedTokenResponseSchema,
  ListExpertBookingsQuerySchema,
  ListExpertBookingsResponseSchema,
  AcceptExpertBookingResponseSchema,
  DeclineExpertBookingRequestSchema,
  DeclineExpertBookingResponseSchema,
  CreateOrganizationRequestSchema,
  CreateOrganizationResponseSchema,
  ExpertOnboardingStepSchema,
  ListOrganizationsMineResponseSchema,
  ListPublicExpertsQuerySchema,
  ListPublicExpertsResponseSchema,
  PublicBookingLinkResponseSchema,
  PublicEventTypeDetailSchema,
  PublicExpertProfileSchema,
  PublicSlotsQuerySchema,
  PublicSlotsResponseSchema,
  ReserveBookingRequestSchema,
  ReserveBookingResponseSchema,
  ConfirmBookingRequestSchema,
  ConfirmBookingResponseSchema,
  BookingReminderRequestSchema,
  BookingReminderResponseSchema,
  ListInboxResponseSchema,
  MarkInboxReadResponseSchema,
  MarkInboxReadAllResponseSchema,
  VerifyPhoneStartRequestSchema,
  VerifyPhoneStartResponseSchema,
  VerifyPhoneConfirmRequestSchema,
  VerifyPhoneConfirmResponseSchema,
  CreatePaymentIntentRequestSchema,
  CreatePaymentIntentResponseSchema,
  RefundBookingPaymentRequestSchema,
  RefundBookingPaymentResponseSchema,
  ListPayoutsQuerySchema,
  ListPayoutsResponseSchema,
  PayoutActionRequestSchema,
  PayoutActionResponseSchema,
  FinanceSummaryResponseSchema,
  SetActiveOrganizationRequestSchema,
  SetActiveOrganizationResponseSchema,
  MeProfileSchema,
  PatchMeRequestSchema,
  ListMeBookingsQuerySchema,
  ListMeBookingsResponseSchema,
  ListMePaymentsQuerySchema,
  ListMePaymentsResponseSchema,
  PutNotificationPreferencesRequestSchema,
  MeNotificationPreferencesResponseSchema,
  ListMeConsentsResponseSchema,
  PutMeConsentRequestSchema,
  ListMeRecordAccessOptoutsResponseSchema,
  PutMeRecordAccessOptoutRequestSchema,
  CancelMeBookingResponseSchema,
  CancellationQuoteSchema,
  RescheduleMeBookingRequestSchema,
  RescheduleMeBookingResponseSchema,
  CreateDsarRequestResponseSchema,
  DsarRequestStatusResponseSchema,
  DeleteAccountResponseSchema,
  CancelDeletionResponseSchema,
  ConnectAccountingResponseSchema,
  InvoicingRequestSchema,
  ListExpertInvoicesQuerySchema,
  ListExpertInvoicesResponseSchema,
  ExpertInvoiceActionRequestSchema,
  EmptyRequestSchema,
  ExpertInvoiceActionResponseSchema,
  ExportSaftQuerySchema,
  ExportSaftResponseSchema,
  ExportSaftFileQuerySchema,
  GetAccountingReconciliationQuerySchema,
  GetAccountingReconciliationResponseSchema,
  ListPlatformFeeInvoicesQuerySchema,
  ListPlatformFeeInvoicesResponseSchema,
  IssuePlatformFeeInvoiceRequestSchema,
  IssuePlatformFeeInvoiceResponseSchema,
  DisconnectAccountingResponseSchema,
  ClosedGateInvoicePayloadSchema,
  EditorAssistRequestSchema,
  DsarExportWorkflowRequestSchema,
  ReconciliationWorkflowRequestSchema,
  KekRotationWorkflowRequestSchema,
  JoinSessionRequestSchema,
  JoinSessionResponseSchema,
  JoinSessionErrorSchema,
  AddSessionParticipantRequestSchema,
  AddSessionParticipantResponseSchema,
  RemoveSessionParticipantResponseSchema,
  DailyWebhookResponseSchema,
  ListMeReportsResponseSchema,
  ListSessionRecordsResponseSchema,
  PublishSessionRecordResponseSchema,
  UpsertSessionRecordRequestSchema,
  UpsertSessionRecordResponseSchema,
  SummarizeSessionRecordsResponseSchema,
  SessionReportDraftRequestSchema,
  SessionReportDraftResponseSchema,
  SessionReportDraftStatusResponseSchema,
  ListSessionDocumentsResponseSchema,
  CompleteSessionDocumentRequestSchema,
  CompleteSessionDocumentResponseSchema,
  SessionDocumentUrlResponseSchema,
  ListRecordTemplatesResponseSchema,
  CreateRecordTemplateRequestSchema,
  UpdateRecordTemplateRequestSchema,
  RecordTemplateSchema,
  RecordTemplateKindSchema,
  RecordTemplatePhiErrorSchema,
  ApplyRecordTemplateRequestSchema,
  ApplyRecordTemplateResponseSchema,
  CreateCrmContactRequestSchema,
  CreateCrmFollowUpRequestSchema,
  CrmContactSchema,
  CrmFollowUpSchema,
  ListCrmContactsQuerySchema,
  ListCrmContactsResponseSchema,
  ListCrmFollowUpsQuerySchema,
  ListCrmFollowUpsResponseSchema,
  UpdateCrmContactRequestSchema,
} from "@eleva/api-client"

const ErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
  message: z.string().optional(),
  code: z.string().optional(),
})

const ConnectIncompleteErrorSchema = z.object({
  error: z.literal("CONNECT_INCOMPLETE"),
  code: z.literal("CONNECT_INCOMPLETE"),
  message: z.string(),
})

const IdentityDisabledErrorSchema = z.object({
  error: z.literal("IDENTITY_DISABLED"),
  code: z.literal("IDENTITY_DISABLED"),
  message: z.string(),
})

const StripeWebhookAcceptedSchema = z.object({
  received: z.literal(true),
  status: z.enum(["processed", "ignored", "duplicate", "failed_terminal"]),
  eventType: z.string().optional(),
  error: z.string().optional(),
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

const StripeWebhookInitErrorSchema = z.union([
  StripeWebhookErrorSchema,
  z.object({ error: z.literal("webhook_not_configured") }),
  z.object({
    error: z.literal("stripe_init_failed"),
    message: z.string(),
  }),
])

const RateLimitErrorSchema = z.object({
  error: z.literal("rate_limit_exceeded"),
  retryAfter: z.number(),
})

const OkSchema = z.object({ ok: z.literal(true) })

const emptyRequestBody = {
  required: false,
  content: { "application/json": { schema: EmptyRequestSchema } },
}

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

const stdPublicErrors = {
  "422": {
    description: "Validation error",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "429": {
    description: "Rate limit exceeded",
    content: { "application/json": { schema: RateLimitErrorSchema } },
  },
} as const

const stdPublicWithNotFound = {
  ...stdPublicErrors,
  "404": {
    description: "Not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const

const stdWithNotFound = {
  ...stdErrors,
  "404": {
    description: "Not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const

const stdRefundErrors = {
  ...stdErrors,
  "403": {
    description: "Missing refund capability or organization mismatch",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "404": {
    description: "Booking payment not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "409": {
    description: "Policy or payout-state conflict",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "502": {
    description: "Stripe refund failed",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const

const stdWithPayoutMutation = {
  ...stdErrors,
  "400": {
    description: "Reason required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "403": {
    description: "Staff finance or platform_admin required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "404": {
    description: "Payout not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  "409": {
    description: "DISPUTE_OPEN or illegal payout state",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const

const WorkflowResultSchema = z
  .object({ ok: z.literal(true) })
  .catchall(z.unknown())

const WorkflowFailureSchema = z.union([
  z
    .object({
      ok: z.literal(false),
      error: z.string(),
      message: z.string().optional(),
    })
    .catchall(z.unknown()),
  ErrorSchema,
])

const ProbeReportSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  ranAt: z.string().datetime(),
  durationMs: z.number().int(),
  checks: z.unknown(),
})

function internalWorkflow(op: {
  operationId: string
  summary: string
  description: string
  requestSchema?: z.ZodType
  requestRequired?: boolean
}): ZodOpenApiPathItemObject {
  return {
    post: {
      operationId: op.operationId,
      summary: op.summary,
      description: `${op.description} Auth: QStash signature or Bearer WORKFLOWS_DRAIN_SECRET.`,
      tags: ["Workflows"],
      ...(op.requestSchema
        ? {
            requestBody: {
              required: op.requestRequired ?? false,
              content: { "application/json": { schema: op.requestSchema } },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "Run finished; counters vary per workflow",
          content: { "application/json": { schema: WorkflowResultSchema } },
        },
        "401": {
          description: "Unauthorized",
          content: { "application/json": { schema: ErrorSchema } },
        },
        ...(op.requestSchema
          ? {
              "422": {
                description: "Validation error",
                content: { "application/json": { schema: ErrorSchema } },
              },
            }
          : {}),
        "500": {
          description:
            "Run failed (safe to retry) or WORKFLOWS_DRAIN_SECRET missing",
          content: { "application/json": { schema: WorkflowFailureSchema } },
        },
      },
    },
  }
}

function cronProbe(op: {
  operationId: string
  summary: string
  description: string
}): ZodOpenApiPathItemObject {
  return {
    get: {
      operationId: op.operationId,
      summary: op.summary,
      description: `${op.description} Auth: Bearer CRON_SECRET (Vercel Cron).`,
      tags: ["System"],
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "All checks healthy",
          content: { "application/json": { schema: ProbeReportSchema } },
        },
        "401": {
          description: "Unauthorized",
          content: { "application/json": { schema: ErrorSchema } },
        },
        "500": {
          description: "Degraded checks (same body) or CRON_SECRET missing",
          content: {
            "application/json": {
              schema: z.union([ProbeReportSchema, ErrorSchema]),
            },
          },
        },
      },
    },
  }
}

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
            "Creates a personal Space and membership in auth.*, then confirms onboarding. Protected by BotID on browser sessions.",
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
          summary: "Confirm an existing organization membership",
          description:
            "Used by account onboarding when a user already has an organization membership. Confirms auth.* membership through the API boundary.",
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
      "/organizations/active": {
        post: {
          operationId: "setActiveOrganization",
          summary: "Set the active organization on the current session",
          tags: ["Organizations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: SetActiveOrganizationRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Active organization updated",
              content: {
                "application/json": {
                  schema: SetActiveOrganizationResponseSchema,
                },
              },
            },
            ...stdErrors,
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
      "/expert/profile": {
        patch: {
          operationId: "patchExpertProfile",
          summary: "Update expert profile fields",
          tags: ["Expert Profile"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: PatchExpertProfileRequestSchema,
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
      "/expert/profile/ensure": {
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
      "/expert/profile/steps/{step}/complete": {
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
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Step completed",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/profile/invoicing": {
        put: {
          operationId: "setInvoicingChoice",
          summary: "Set expert invoicing provider",
          tags: ["Expert Profile"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: InvoicingRequestSchema,
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
      "/expert/schedule": {
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
      "/expert/schedule/overrides": {
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
      "/expert/schedule/overrides/{id}": {
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
      "/expert/practice": {
        get: {
          operationId: "getExpertPractice",
          summary: "Get expert practice scope",
          tags: ["Expert Practice"],
          responses: {
            "200": {
              description: "Practice scope",
              content: {
                "application/json": {
                  schema: z.object({ practice: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        patch: {
          operationId: "patchExpertPractice",
          summary: "Update expert practice scope",
          tags: ["Expert Practice"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  practiceCountry: z.string().length(2).optional(),
                  serviceCountries: z.array(z.string().length(2)).optional(),
                  languages: z.array(z.string()).optional(),
                  licenseScope: z.string().nullable().optional(),
                  worldwideRemote: z.boolean().optional(),
                  acceptingBookings: z.boolean().optional(),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Practice updated",
              content: {
                "application/json": {
                  schema: z.object({ practice: z.unknown() }),
                },
              },
            },
            "409": {
              description: "Published modes would violate offer invariants",
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/locations": {
        get: {
          operationId: "listExpertLocations",
          summary: "List practice locations",
          tags: ["Expert Locations"],
          responses: {
            "200": {
              description: "Locations",
              content: {
                "application/json": {
                  schema: z.object({ locations: z.array(z.unknown()) }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        post: {
          operationId: "createExpertLocation",
          summary: "Create a practice location",
          tags: ["Expert Locations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  name: z.string(),
                  address: z.string(),
                  city: z.string(),
                  country: z.string().length(2),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Location created",
              content: {
                "application/json": {
                  schema: z.object({ location: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/locations/{id}": {
        get: {
          operationId: "getExpertLocation",
          summary: "Get a practice location",
          tags: ["Expert Locations"],
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
              description: "Location",
              content: {
                "application/json": {
                  schema: z.object({ location: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        patch: {
          operationId: "patchExpertLocation",
          summary: "Update a practice location",
          tags: ["Expert Locations"],
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
              "application/json": { schema: z.object({}).passthrough() },
            },
          },
          responses: {
            "200": {
              description: "Location updated",
              content: {
                "application/json": {
                  schema: z.object({ location: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        delete: {
          operationId: "deleteExpertLocation",
          summary: "Archive a practice location",
          tags: ["Expert Locations"],
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
              description: "Location archived",
              content: {
                "application/json": {
                  schema: z.object({
                    location: z.unknown(),
                    archived: z.literal(true),
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/schedules": {
        get: {
          operationId: "listExpertSchedules",
          summary: "List named schedules",
          tags: ["Expert Schedules"],
          responses: {
            "200": {
              description: "Schedules",
              content: {
                "application/json": {
                  schema: z.object({ schedules: z.array(z.unknown()) }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        post: {
          operationId: "createExpertSchedule",
          summary: "Create a named schedule",
          tags: ["Expert Schedules"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  name: z.string(),
                  timezone: z.string(),
                  isDefault: z.boolean().optional(),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Schedule created",
              content: {
                "application/json": {
                  schema: z.object({ schedule: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/schedules/{id}": {
        get: {
          operationId: "getExpertSchedule",
          summary: "Get a schedule with rules and overrides",
          tags: ["Expert Schedules"],
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
              description: "Schedule",
              content: {
                "application/json": {
                  schema: z.object({ schedule: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        patch: {
          operationId: "patchExpertSchedule",
          summary: "Update schedule metadata",
          tags: ["Expert Schedules"],
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
                  name: z.string().optional(),
                  timezone: z.string().optional(),
                  isDefault: z.boolean().optional(),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Schedule updated",
              content: {
                "application/json": {
                  schema: z.object({ schedule: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        delete: {
          operationId: "deleteExpertSchedule",
          summary: "Soft-delete a non-default schedule",
          tags: ["Expert Schedules"],
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
              description: "Schedule deleted",
              content: { "application/json": { schema: OkSchema } },
            },
            "409": { description: "Schedule still referenced by modes" },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/schedules/{id}/rules": {
        put: {
          operationId: "putExpertScheduleRules",
          summary: "Replace weekly availability rules",
          tags: ["Expert Schedules"],
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
                  rules: z.array(
                    z.object({
                      dayOfWeek: z.number().int(),
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
              description: "Rules replaced",
              content: {
                "application/json": {
                  schema: z.object({ rules: z.array(z.unknown()) }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/schedules/{id}/overrides": {
        put: {
          operationId: "putExpertScheduleOverrides",
          summary: "Replace date overrides for a schedule",
          tags: ["Expert Schedules"],
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
                  overrides: z.array(
                    z.object({
                      overrideDate: z.string(),
                      startTime: z.string().nullable().optional(),
                      endTime: z.string().nullable().optional(),
                      isBlocked: z.boolean(),
                    })
                  ),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Overrides replaced",
              content: {
                "application/json": {
                  schema: z.object({ overrides: z.array(z.unknown()) }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/event-types": {
        post: {
          operationId: "createEventType",
          summary: "Create an event type",
          tags: ["Expert Event Types"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CreateEventTypeRequestSchema,
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
      "/expert/event-types/{id}": {
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
                schema: UpdateEventTypeRequestSchema,
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
      "/expert/event-types/{id}/publish": {
        post: {
          operationId: "publishEventType",
          summary: "Publish an event type after offer-invariant checks",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Event type published",
              content: { "application/json": { schema: OkSchema } },
            },
            "409": {
              description:
                "CONNECT_INCOMPLETE — Payments onboarding not ready (details submitted, payouts enabled, transfers active, and Identity verified when required)",
              content: {
                "application/json": { schema: ConnectIncompleteErrorSchema },
              },
            },
            ...stdWithNotFound,
            "422": {
              description:
                "Validation error (unexpected body), or OFFER_INVARIANT_VIOLATION — active modes fail publishEventType gates (handle, modes, country/language scope)",
              content: {
                "application/json": {
                  schema: z.union([
                    ErrorSchema,
                    z.object({
                      error: z.literal("OFFER_INVARIANT_VIOLATION"),
                      code: z.literal("OFFER_INVARIANT_VIOLATION"),
                      message: z.string(),
                      violations: z.array(
                        z.object({
                          modeId: z.string().nullable(),
                          code: z.string(),
                          message: z.string(),
                        })
                      ),
                    }),
                  ]),
                },
              },
            },
          },
        },
      },
      "/expert/event-types/{id}/unpublish": {
        post: {
          operationId: "unpublishEventType",
          summary: "Unpublish an event type",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Event type unpublished",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/event-types/{id}/modes": {
        get: {
          operationId: "listEventTypeModes",
          summary: "List delivery modes for an event type",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "includeInactive",
              in: "query",
              required: false,
              schema: { type: "boolean" },
            },
          ],
          responses: {
            "200": {
              description: "Modes listed",
              content: {
                "application/json": {
                  schema: z.object({ modes: z.array(z.unknown()) }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        post: {
          operationId: "createEventTypeMode",
          summary: "Create a delivery mode (offer-invariants enforced)",
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
                schema: CreateEventTypeModeRequestSchema,
              },
            },
          },
          responses: {
            "201": {
              description: "Mode created",
              content: {
                "application/json": {
                  schema: z.object({ mode: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/event-types/{id}/modes/{modeId}": {
        get: {
          operationId: "getEventTypeMode",
          summary: "Get a delivery mode",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "modeId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Mode returned",
              content: {
                "application/json": {
                  schema: z.object({ mode: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        patch: {
          operationId: "patchEventTypeMode",
          summary: "Update a delivery mode (offer-invariants enforced)",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "modeId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: PatchEventTypeModeRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Mode updated",
              content: {
                "application/json": {
                  schema: z.object({ mode: z.unknown() }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        delete: {
          operationId: "deactivateEventTypeMode",
          summary: "Soft-deactivate a delivery mode",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "modeId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Mode deactivated",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/event-types/{id}/destination": {
        patch: {
          operationId: "setEventTypeDestination",
          summary: "Set or clear the event-type destination calendar override",
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
                schema: EventTypeDestinationOverrideSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Destination override updated",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    destination: EventTypeDestinationOverrideSchema,
                  }),
                },
              },
            },
            "403": {
              description: "Calendar integration not owned by this expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Failed to fetch calendars from provider",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/event-types/{id}/modes/{modeId}/destination": {
        patch: {
          operationId: "setEventTypeModeDestination",
          summary:
            "Set or clear the per-mode destination calendar override (highest priority)",
          tags: ["Expert Event Types"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "modeId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: EventTypeDestinationOverrideSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Mode destination override updated",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    destination: EventTypeDestinationOverrideSchema,
                  }),
                },
              },
            },
            "403": {
              description: "Calendar integration not owned by this expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description: "Failed to fetch calendars from provider",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/booking-links": {
        get: {
          operationId: "listExpertBookingLinks",
          summary: "List private booking links for an event type",
          tags: ["Expert Booking Links"],
          requestParams: {
            query: z.object({ eventTypeId: z.string().uuid() }),
          },
          responses: {
            "200": {
              description: "Booking links",
              content: {
                "application/json": {
                  schema: z.object({
                    links: z.array(BookingLinkListItemSchema),
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        post: {
          operationId: "createExpertBookingLink",
          summary: "Create a private booking link (raw token returned once)",
          tags: ["Expert Booking Links"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CreateBookingLinkRequestSchema,
              },
            },
          },
          responses: {
            "201": {
              description: "Booking link created",
              content: {
                "application/json": {
                  schema: CreateBookingLinkResponseSchema,
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/booking-links/{id}/revoke": {
        post: {
          operationId: "revokeExpertBookingLink",
          summary: "Revoke a private booking link",
          tags: ["Expert Booking Links"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Booking link revoked",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    link: BookingLinkListItemSchema,
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/integrations/{id}": {
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
      "/expert/integrations/{id}/calendars": {
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
      "/expert/integrations/{id}/busy-sources": {
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
      "/expert/integrations/{id}/destination": {
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
      "/expert/bookings": {
        get: {
          operationId: "listExpertBookings",
          summary: "List expert bookings in a date range",
          tags: ["Expert Calendar"],
          requestParams: {
            query: ListExpertBookingsQuerySchema,
          },
          responses: {
            "200": {
              description: "Bookings in range",
              content: {
                "application/json": {
                  schema: ListExpertBookingsResponseSchema,
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/bookings/{id}/accept": {
        post: {
          operationId: "acceptExpertBookingRequest",
          summary: "Accept a Request to book",
          description:
            "Flips awaiting_confirmation to confirmed, creates the session and guest activation, and emits booking.request_accepted. Idempotent if already confirmed.",
          tags: ["Expert Calendar"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Request accepted",
              content: {
                "application/json": {
                  schema: AcceptExpertBookingResponseSchema,
                },
              },
            },
            "409": {
              description:
                "Not awaiting confirmation, or the response window ended",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/bookings/{id}/decline": {
        post: {
          operationId: "declineExpertBookingRequest",
          summary: "Decline a Request to book",
          description:
            "Cancels an awaiting_confirmation booking, refunds 100%, and releases the slot.",
          tags: ["Expert Calendar"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: DeclineExpertBookingRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Request declined",
              content: {
                "application/json": {
                  schema: DeclineExpertBookingResponseSchema,
                },
              },
            },
            "409": {
              description: "Not awaiting confirmation",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/expert/calendar/feed-token": {
        get: {
          operationId: "getCalendarFeedTokenStatus",
          summary: "Whether an active ICS feed token exists",
          tags: ["Expert Calendar"],
          responses: {
            "200": {
              description: "Feed token status (raw token never returned)",
              content: {
                "application/json": {
                  schema: CalendarFeedTokenStatusSchema,
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        post: {
          operationId: "rotateCalendarFeedToken",
          summary: "Create or rotate the ICS feed token (raw token once)",
          tags: ["Expert Calendar"],
          requestBody: emptyRequestBody,
          responses: {
            "201": {
              description: "New feed token",
              content: {
                "application/json": {
                  schema: RotateCalendarFeedTokenResponseSchema,
                },
              },
            },
            ...stdWithNotFound,
          },
        },
        delete: {
          operationId: "revokeCalendarFeedToken",
          summary: "Revoke the active ICS feed token",
          tags: ["Expert Calendar"],
          responses: {
            "200": {
              description: "Feed token revoked",
              content: { "application/json": { schema: OkSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/calendar/feed/{token}": {
        get: {
          operationId: "getCalendarIcsFeed",
          summary: "Public read-only ICS feed (append .ics to the token)",
          tags: ["Public Calendar"],
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Raw feed token, optionally with .ics suffix",
            },
          ],
          responses: {
            "200": {
              description: "text/calendar VCALENDAR body",
              content: {
                "text/calendar": {
                  schema: z.string(),
                },
              },
            },
            "304": {
              description: "Not modified (ETag match)",
            },
            "404": {
              description: "Unknown or revoked token",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdPublicErrors,
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
          requestBody: emptyRequestBody,
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
            "409": {
              description:
                "ff.expert_identity_verification is off (IDENTITY_DISABLED)",
              content: {
                "application/json": { schema: IdentityDisabledErrorSchema },
              },
            },
            "502": {
              description: "Stripe API error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/stripe/connect-account": {
        post: {
          operationId: "createConnectAccount",
          summary: "Provision a Stripe Connect Express account",
          description:
            "Creates a Connect Express account for the authenticated expert when Payments onboarding has no stripeAccountId. Idempotent: returns the existing account when already provisioned. Stripe create runs outside the DB transaction.",
          tags: ["Stripe"],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: CreateConnectAccountRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Connect account provisioned or reused",
              content: {
                "application/json": {
                  schema: CreateConnectAccountResponseSchema,
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
            "Stripe-signed webhook receiver. Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` and dispatches the event through `processStripeEvent`. Persists each `event.id` in `stripe_webhook_events` for idempotency. Returns 200 for processed, ignored, duplicate, or failed_terminal; 500 for retryable handler failures, missing signing secret, or Stripe SDK init failure (so Stripe redelivers retryable cases).",
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
              description:
                "Event accepted (processed | ignored | duplicate | failed_terminal)",
              content: {
                "application/json": {
                  schema: StripeWebhookAcceptedSchema,
                },
              },
            },
            "400": {
              description: "Missing or invalid signature",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description:
                "Retryable handler failure, missing signing secret, or Stripe SDK init failure",
              content: {
                "application/json": { schema: StripeWebhookInitErrorSchema },
              },
            },
          },
        },
      },
      "/webhooks/stripe/connect": {
        post: {
          operationId: "stripeConnectWebhook",
          summary: "Stripe Connect webhook receiver",
          description:
            "Connected-account Stripe webhook receiver. Verifies `stripe-signature` against `STRIPE_CONNECT_WEBHOOK_SECRET` and dispatches through the same `processStripeEvent` as `/webhooks/stripe`. Returns 200 for processed, ignored, duplicate, or failed_terminal; 500 for retryable handler failures, missing signing secret, or Stripe SDK init failure.",
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
              description:
                "Event accepted (processed | ignored | duplicate | failed_terminal)",
              content: {
                "application/json": {
                  schema: StripeWebhookAcceptedSchema,
                },
              },
            },
            "400": {
              description: "Missing or invalid signature",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description:
                "Retryable handler failure, missing signing secret, or Stripe SDK init failure",
              content: {
                "application/json": { schema: StripeWebhookInitErrorSchema },
              },
            },
          },
        },
      },
      "/public/experts": {
        get: {
          operationId: "listPublicExperts",
          summary: "List public experts",
          tags: ["Public"],
          security: [],
          requestParams: {
            query: ListPublicExpertsQuerySchema,
          },
          responses: {
            "200": {
              description: "Paginated public expert cards",
              content: {
                "application/json": {
                  schema: ListPublicExpertsResponseSchema,
                },
              },
            },
            ...stdPublicErrors,
          },
        },
      },
      "/public/experts/{username}": {
        get: {
          operationId: "getPublicExpert",
          summary: "Get a public expert profile",
          tags: ["Public"],
          security: [],
          requestParams: {
            path: z.object({ username: z.string() }),
          },
          responses: {
            "200": {
              description: "Public expert profile with bookable event types",
              content: {
                "application/json": { schema: PublicExpertProfileSchema },
              },
            },
            ...stdPublicWithNotFound,
          },
        },
      },
      "/public/experts/{username}/event-types/{slug}": {
        get: {
          operationId: "getPublicEventType",
          summary: "Get a public event type and its modes",
          tags: ["Public"],
          security: [],
          requestParams: {
            path: z.object({ username: z.string(), slug: z.string() }),
          },
          responses: {
            "200": {
              description: "Public event type with bookable modes",
              content: {
                "application/json": { schema: PublicEventTypeDetailSchema },
              },
            },
            ...stdPublicWithNotFound,
          },
        },
      },
      "/public/experts/{username}/event-types/{slug}/slots": {
        get: {
          operationId: "getPublicEventTypeSlots",
          summary: "List available slots for an event-type mode",
          tags: ["Public"],
          security: [],
          requestParams: {
            path: z.object({ username: z.string(), slug: z.string() }),
            query: PublicSlotsQuerySchema,
          },
          responses: {
            "200": {
              description: "Available slots in UTC and the viewer timezone",
              content: {
                "application/json": { schema: PublicSlotsResponseSchema },
              },
            },
            ...stdPublicWithNotFound,
          },
        },
      },
      "/bookings/reserve": {
        post: {
          operationId: "reserveBooking",
          summary: "Reserve a booking slot",
          description:
            "Holds a public or private-link slot for 5 minutes after consent, mode, and availability checks. Optional session; guests send email and name. Returns a one-time reservationToken that is never logged. Send the cancellationPolicy the member was shown; it is stored on the hold and snapshotted onto the booking.",
          tags: ["Bookings"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: ReserveBookingRequestSchema },
            },
          },
          responses: {
            "201": {
              description: "Slot reserved",
              content: {
                "application/json": { schema: ReserveBookingResponseSchema },
              },
            },
            "403": {
              description: "Bot detected",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description:
                "Slot already taken, member cannot book (deletion scheduled / banned), or POLICY_CHANGED when the sent cancellationPolicy no longer matches the service",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description: "Reservation write failed",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "503": {
              description:
                "Reservation lock unavailable, or `calendar_unavailable` when a connected external calendar could not be checked (retry after `Retry-After`)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdPublicWithNotFound,
            "422": {
              description:
                "Consent, mode, guest, phone, or unpublished/unavailable slot",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/payments/intent": {
        post: {
          operationId: "createBookingPaymentIntent",
          summary: "Create a PaymentIntent for a reserved slot",
          description:
            "Authorizes the reservationToken, inserts a pending_payment booking, then creates a platform PaymentIntent (no Stripe calls inside a DB transaction). Token or user mismatches return 404.",
          tags: ["Payments"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreatePaymentIntentRequestSchema },
            },
          },
          responses: {
            "201": {
              description: "PaymentIntent created",
              content: {
                "application/json": {
                  schema: CreatePaymentIntentResponseSchema,
                },
              },
            },
            "403": {
              description: "Bot detected",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Member cannot book (deletion scheduled or banned)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "503": {
              description: "Stripe or snapshot unavailable",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description: "Intent write failed",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdPublicWithNotFound,
            "422": {
              description: "Invalid reservationId or reservationToken",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/payments/{bookingPaymentId}/refund": {
        post: {
          operationId: "refundBookingPayment",
          summary: "Refund a booking payment (full or partial)",
          description:
            "Creates a Stripe refund then, when a transfer exists, a transfer reversal. Expert `billing:refund` on the owning org, or staff `admin_payouts:refund`.",
          tags: ["Payments"],
          requestParams: {
            path: z.object({ bookingPaymentId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: RefundBookingPaymentRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Refund accepted",
              content: {
                "application/json": {
                  schema: RefundBookingPaymentResponseSchema,
                },
              },
            },
            ...stdRefundErrors,
          },
        },
      },
      "/payouts": {
        get: {
          operationId: "listPayouts",
          summary: "List payout ledger rows",
          description:
            "Experts see their active org only (`orgId` must match or is implied). Staff with `admin_payouts:read` may filter by org.",
          tags: ["Payouts"],
          requestParams: {
            query: ListPayoutsQuerySchema,
          },
          responses: {
            "200": {
              description: "Payout list",
              content: {
                "application/json": { schema: ListPayoutsResponseSchema },
              },
            },
            ...stdWithNotFound,
            "403": {
              description: "Missing payouts:view_own or admin_payouts:read",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/payouts/{id}/approve": {
        post: {
          operationId: "approvePayout",
          summary: "Approve an approval_required payout",
          description:
            "Staff-only (`platform_admin` or `staff_finance`) with `admin_payouts:approve`. Refused with 409 DISPUTE_OPEN while a dispute is open.",
          tags: ["Payouts"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: PayoutActionRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Payout approved",
              content: {
                "application/json": { schema: PayoutActionResponseSchema },
              },
            },
            ...stdWithPayoutMutation,
          },
        },
      },
      "/payouts/{id}/hold": {
        post: {
          operationId: "holdPayout",
          summary: "Add a manual hold to a payout",
          tags: ["Payouts"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: PayoutActionRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Hold applied",
              content: {
                "application/json": { schema: PayoutActionResponseSchema },
              },
            },
            ...stdWithPayoutMutation,
          },
        },
      },
      "/payouts/{id}/release": {
        post: {
          operationId: "releasePayoutHold",
          summary: "Remove a manual hold from a payout",
          tags: ["Payouts"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: PayoutActionRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Hold released (or remaining dispute hold)",
              content: {
                "application/json": { schema: PayoutActionResponseSchema },
              },
            },
            ...stdWithPayoutMutation,
          },
        },
      },
      "/me/finance/summary": {
        get: {
          operationId: "getExpertFinanceSummary",
          summary: "Expert earnings summary and booking payout table",
          tags: ["Finance"],
          responses: {
            "200": {
              description: "Summary cards plus per-booking rows",
              content: {
                "application/json": { schema: FinanceSummaryResponseSchema },
              },
            },
            ...stdErrors,
            "403": {
              description: "Missing payouts:view_own",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/bookings/confirm": {
        post: {
          operationId: "confirmBookingPayment",
          summary: "Confirm a paid booking reservation",
          description:
            "Authorizes reservationToken like /payments/intent, retrieves the PaymentIntent from Stripe, and flips pending_payment → confirmed. First flip returns 201; retries return 200 with alreadyConfirmed. Mismatched intents return 409 PAYMENT_MISMATCH.",
          tags: ["Bookings"],
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: ConfirmBookingRequestSchema },
            },
          },
          responses: {
            ...stdPublicWithNotFound,
            "201": {
              description: "Booking confirmed",
              content: {
                "application/json": { schema: ConfirmBookingResponseSchema },
              },
            },
            "200": {
              description: "Already confirmed",
              content: {
                "application/json": { schema: ConfirmBookingResponseSchema },
              },
            },
            "400": {
              description: "Missing reservationToken or invalid body",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "PAYMENT_MISMATCH",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "403": {
              description: "Bot detected",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "503": {
              description: "Stripe retrieve unavailable",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description: "Confirmation write failed",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/public/booking-links/{token}": {
        get: {
          operationId: "getPublicBookingLink",
          summary: "Resolve a private booking link",
          tags: ["Public"],
          security: [],
          requestParams: {
            path: z.object({ token: z.string() }),
          },
          responses: {
            "200": {
              description: "Usable booking link",
              content: {
                "application/json": {
                  schema: PublicBookingLinkResponseSchema,
                },
              },
            },
            ...stdPublicWithNotFound,
          },
        },
      },
      "/me": {
        get: {
          operationId: "getMe",
          summary: "Get the authenticated member profile and preferences",
          tags: ["Me"],
          responses: {
            "200": {
              description: "Member profile",
              content: { "application/json": { schema: MeProfileSchema } },
            },
            ...stdWithNotFound,
          },
        },
        patch: {
          operationId: "patchMe",
          summary: "Update the authenticated member profile",
          description:
            "Updates name, timezone, locale, and/or avatarUrl. At least one field is required. Avatar bytes stay on PUT /users/avatar.",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: PatchMeRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Updated profile",
              content: { "application/json": { schema: MeProfileSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/me/bookings": {
        get: {
          operationId: "listMeBookings",
          summary: "List the authenticated member's bookings",
          description:
            "Reads via withOrgContext(session.orgId) plus member_user_id. Expert and event-type joins run in the expert org.",
          tags: ["Me"],
          requestParams: { query: ListMeBookingsQuerySchema },
          responses: {
            "200": {
              description: "Upcoming or past bookings",
              content: {
                "application/json": { schema: ListMeBookingsResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/me/payments": {
        get: {
          operationId: "listMePayments",
          summary: "List the authenticated member's booking payments",
          description:
            "Joins booking_payments. receipt_url is served from cache or retrieved via @eleva/billing and then cached.",
          tags: ["Me"],
          requestParams: { query: ListMePaymentsQuerySchema },
          responses: {
            "200": {
              description: "Member payments",
              content: {
                "application/json": { schema: ListMePaymentsResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/me/phone/verify-start": {
        post: {
          operationId: "verifyPhoneStart",
          summary: "Start SMS phone verification",
          description:
            "Sends a 6-digit OTP (10-minute TTL, hashed) via Twilio EU. Rate-limited at the public 10/min cap to prevent SMS bombing. Does not return the code.",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: VerifyPhoneStartRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "OTP sent or phone already verified for this user",
              content: {
                "application/json": {
                  schema: VerifyPhoneStartResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/me/phone/verify-confirm": {
        post: {
          operationId: "verifyPhoneConfirm",
          summary: "Confirm SMS phone verification",
          description:
            "Checks the hashed OTP, writes auth.user.phone_e164 + phone_verified_at, and emits phone.verified. SMS reminders stay off until this succeeds.",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: VerifyPhoneConfirmRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Phone verified",
              content: {
                "application/json": {
                  schema: VerifyPhoneConfirmResponseSchema,
                },
              },
            },
            "409": {
              description: "Phone already verified on another account",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/webhooks/twilio/status": {
        post: {
          operationId: "twilioStatusWebhook",
          summary: "Twilio SMS StatusCallback",
          description:
            "Validates X-Twilio-Signature against API_URL origin + path + the raw query string (never re-encoded). Marks the sms notification_deliveries row sent or failed.",
          tags: ["Webhooks"],
          security: [],
          parameters: [
            {
              name: "deliveryId",
              in: "query",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "x-twilio-signature",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/x-www-form-urlencoded": {
                schema: z
                  .object({
                    MessageSid: z.string(),
                    MessageStatus: z.string(),
                    ErrorMessage: z.string().optional(),
                  })
                  .passthrough(),
              },
            },
          },
          responses: {
            "200": {
              description: "Callback accepted",
              content: {
                "application/json": {
                  schema: z.object({ ok: z.literal(true) }),
                },
              },
            },
            ...stdErrors,
            "401": {
              description: "Missing or invalid Twilio signature",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/webhooks/resend": {
        post: {
          operationId: "resendWebhook",
          summary: "Resend delivery-events webhook",
          description:
            "Verifies Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) against `RESEND_WEBHOOK_SECRET`. Handles `email.delivered`, `email.bounced`, and `email.complained`: updates `notification_deliveries` (matched by `tags.deliveryId` or `provider_id`) and upserts `email_suppressions` on permanent bounce or complaint. Soft/transient bounces update the delivery row only.",
          tags: ["Webhooks"],
          security: [],
          parameters: [
            {
              name: "svix-id",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "svix-timestamp",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "svix-signature",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z
                  .object({
                    type: z.string(),
                    created_at: z.string(),
                    data: z.record(z.string(), z.unknown()),
                  })
                  .passthrough(),
              },
            },
          },
          responses: {
            "200": {
              description: "Event accepted (handled or ignored)",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(true),
                    handled: z.boolean().optional(),
                  }),
                },
              },
            },
            ...stdErrors,
            "401": {
              description: "Missing or invalid Svix signature",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description:
                "Missing RESEND_WEBHOOK_SECRET or unexpected handler failure",
              content: {
                "application/json": {
                  schema: z.object({
                    ok: z.literal(false),
                    error: z.string(),
                  }),
                },
              },
            },
          },
        },
      },
      "/sessions/{bookingId}/join": {
        post: {
          operationId: "joinSession",
          summary: "Mint a Daily meeting token for a session",
          description:
            "Assigned expert, booking member, or an active delegate can join with a session cookie or bearer token. A signed Eleva join grant (`grant`) joins as that role without a cookie or bearer token and ignores any session. Window is [start-15m, end+30m]. Token exp is min(now+2h, end+30m). Audit payload carries userId and roomName only. Never put a Daily meeting token in a URL.",
          tags: ["Sessions"],
          security: [{}, { bearerAuth: [] }, { cookieAuth: [] }],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          requestBody: {
            required: false,
            content: {
              "application/json": { schema: JoinSessionRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Meeting token minted",
              content: {
                "application/json": { schema: JoinSessionResponseSchema },
              },
            },
            "401": {
              description:
                "Missing session, or join grant is invalid, expired, or for another schedule revision (INVALID_GRANT)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "422": {
              description: "Request body failed validation (invalid_body)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "403": {
              description:
                "Not a participant, or the join window is closed. SESSION_NOT_OPEN includes startsAt and opensAt so the waiting room can name the session time.",
              content: {
                "application/json": { schema: JoinSessionErrorSchema },
              },
            },
            "409": {
              description: "Daily room is not ready",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "410": {
              description: "Session is cancelled, ended, or no-show",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/participants": {
        post: {
          operationId: "addSessionParticipant",
          summary: "Delegate another user onto a session",
          description:
            "Assigned expert only. Raises Daily max_participants. Revoked rows can be re-activated.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: AddSessionParticipantRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Delegate added",
              content: {
                "application/json": {
                  schema: AddSessionParticipantResponseSchema,
                },
              },
            },
            "202": {
              description:
                "Delegate added; Daily room capacity is not yet synced",
              content: {
                "application/json": {
                  schema: AddSessionParticipantResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller is not the assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "User is already an active participant",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "410": {
              description: "Session is not active",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/sessions/{bookingId}/participants/{userId}": {
        delete: {
          operationId: "removeSessionParticipant",
          summary: "Revoke a delegated participant",
          description:
            "Two-phase revoke: set revoked_at (join 403), then Daily eject+ban. Returns 202 when eject is pending retry.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              userId: z.string().uuid(),
            }),
          },
          responses: {
            "200": {
              description: "Revoked and ejected",
              content: {
                "application/json": {
                  schema: RemoveSessionParticipantResponseSchema,
                },
              },
            },
            "202": {
              description: "Revoked; Daily eject will retry",
              content: {
                "application/json": {
                  schema: RemoveSessionParticipantResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller is not the assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "410": {
              description: "Session is not active",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/sessions/{bookingId}/records": {
        get: {
          operationId: "listSessionRecords",
          summary: "List encrypted session records for a booking",
          description:
            "Assigned expert reads intake, in-call notes, live transcript, unpublished internal report, and AI draft for this booking. Member reads only published rows and never the internal report. Bodies are decrypted in the expert org. Not HIPAA.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Session records",
              content: {
                "application/json": {
                  schema: ListSessionRecordsResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller is not the assigned expert or member",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
        put: {
          operationId: "upsertSessionRecord",
          summary: "Save in-call notes, transcript, or internal report",
          description:
            "Assigned expert only. Upserts records.kind note|transcript|internal_report. Internal report stays unpublished (expert-only). Intake is copied from the booking form at confirm and is read-only. AI drafts are written only by POST .../summarize. A transcript needs the member's active ai_processing consent (403 AI_CONSENT_REQUIRED). Audit payload is kind + bookingId (no PHI).",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: UpsertSessionRecordRequestSchema,
              },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Saved record",
              content: {
                "application/json": {
                  schema: UpsertSessionRecordResponseSchema,
                },
              },
            },
            "403": {
              description:
                "Caller is not the assigned expert, or AI_CONSENT_REQUIRED for a transcript",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Intake is read-only",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "422": {
              description: "Request body failed validation",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/records/{recordId}/publish": {
        post: {
          operationId: "publishSessionRecord",
          summary: "Publish a session report to the member",
          description:
            "Assigned expert who wrote the report only. The member can then read it under GET /me/reports. Audited as record.published.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              recordId: z.string().uuid(),
            }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "The report with its new publishedAt",
              content: {
                "application/json": {
                  schema: PublishSessionRecordResponseSchema,
                },
              },
            },
            "409": {
              description:
                "NOT_PUBLISHABLE: only kind report on a booking with a member account",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "403": {
              description: "Caller is not the assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/sessions/{bookingId}/records/{recordId}/unpublish": {
        post: {
          operationId: "unpublishSessionRecord",
          summary: "Hide a published session report from the member",
          description:
            "Assigned expert who wrote the report only. Audited as record.unpublished.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              recordId: z.string().uuid(),
            }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "The report with its new publishedAt",
              content: {
                "application/json": {
                  schema: PublishSessionRecordResponseSchema,
                },
              },
            },
            "409": {
              description:
                "NOT_PUBLISHABLE: only kind report on a booking with a member account",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "403": {
              description: "Caller is not the assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/sessions/{bookingId}/records/summarize": {
        post: {
          operationId: "summarizeSessionRecords",
          summary: "Draft an AI summary of session notes and transcript",
          description:
            "Fail closed until a zero-retention model is on APPROVED_MODELS (ADR-009). Returns 409 AI_MODEL_ZERO_RETENTION_REQUIRED.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          responses: {
            "200": {
              description:
                "AI summary draft (unreachable until a zero-retention model is allow-listed)",
              content: {
                "application/json": {
                  schema: SummarizeSessionRecordsResponseSchema,
                },
              },
            },
            "409": {
              description:
                "No zero-retention model is allow-listed for clinical text",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "403": {
              description: "Caller is not the assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/records/templates": {
        get: {
          operationId: "listRecordTemplates",
          summary: "List the expert org's record templates and Eleva starters",
          description:
            "Requires events:manage in the active expert org. Returns non-archived org templates plus the Eleva starter set (structure only, en/pt/es). Templates are not PHI.",
          tags: ["Records"],
          requestParams: {
            query: z.object({ kind: RecordTemplateKindSchema.optional() }),
          },
          responses: {
            ...stdErrors,
            "200": {
              description: "Templates and starters",
              content: {
                "application/json": {
                  schema: ListRecordTemplatesResponseSchema,
                },
              },
            },
          },
        },
        post: {
          operationId: "createRecordTemplate",
          summary: "Create a record template",
          description:
            "Runs the template PHI scrubber (member identifiers, e-mails, phones, NIF/DNI/NIE, dates, sentences copied from the source record) before any write. With sourceBookingId (Save as template), filled placeholders are tokenised first and the scrubber checks that booking's member. Refuses with 422 PHI_DETECTED and the offending spans. Audited as record_template.created.",
          tags: ["Records"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateRecordTemplateRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "201": {
              description: "Template created",
              content: { "application/json": { schema: RecordTemplateSchema } },
            },
            "422": {
              description:
                "Validation failed or the scrubber found member data",
              content: {
                "application/json": {
                  schema: z.union([RecordTemplatePhiErrorSchema, ErrorSchema]),
                },
              },
            },
          },
        },
      },
      "/records/templates/{templateId}": {
        patch: {
          operationId: "updateRecordTemplate",
          summary: "Edit a record template",
          description:
            "Same PHI scrubber as create. Bumps version. Audited as record_template.updated.",
          tags: ["Records"],
          requestParams: {
            path: z.object({ templateId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: UpdateRecordTemplateRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Template updated",
              content: { "application/json": { schema: RecordTemplateSchema } },
            },
            "422": {
              description:
                "Validation failed or the scrubber found member data",
              content: {
                "application/json": {
                  schema: z.union([RecordTemplatePhiErrorSchema, ErrorSchema]),
                },
              },
            },
          },
        },
        delete: {
          operationId: "archiveRecordTemplate",
          summary: "Archive a record template",
          description:
            "Soft-archives the template. Audited as record_template.archived.",
          tags: ["Records"],
          requestParams: {
            path: z.object({ templateId: z.string().uuid() }),
          },
          responses: {
            ...stdWithNotFound,
            "204": { description: "Archived" },
          },
        },
      },
      "/records/templates/{templateId}/apply": {
        post: {
          operationId: "applyRecordTemplate",
          summary: "Fill a template for one booking",
          description:
            "Assigned expert only. Fills {{member.firstName}}, {{session.date}} and {{expert.name}} for the booking and returns the text for the editor. Nothing is stored.",
          tags: ["Records"],
          requestParams: {
            path: z.object({ templateId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: ApplyRecordTemplateRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Filled template",
              content: {
                "application/json": {
                  schema: ApplyRecordTemplateResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller is not the booking's assigned expert",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/crm/contacts": {
        get: {
          operationId: "listCrmContacts",
          summary: "List the expert's CRM contacts",
          description:
            "Requires events:manage and an expert profile in the active org. Returns the caller's manual leads, then members who booked the caller (session stats from bookings) with their stage and tags. Members without a CRM row show as active; guests are read-only (id null). Lead email/phone are decrypted in the expert org.",
          tags: ["CRM"],
          requestParams: { query: ListCrmContactsQuerySchema },
          responses: {
            ...stdErrors,
            "200": {
              description: "Contacts",
              content: {
                "application/json": { schema: ListCrmContactsResponseSchema },
              },
            },
            "403": {
              description: "Caller has no expert profile in this org",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
        post: {
          operationId: "createCrmContact",
          summary: "Create a lead or a member's CRM row",
          description:
            "With memberUserId: upserts the CRM row for a member who booked the caller (404 MEMBER_NOT_FOUND otherwise). With name: creates a manual lead; email and phone are encrypted with the org key. Audited as crm_contact.created or crm_contact.updated.",
          tags: ["CRM"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateCrmContactRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "201": {
              description: "Contact",
              content: { "application/json": { schema: CrmContactSchema } },
            },
          },
        },
      },
      "/crm/contacts/{contactId}": {
        patch: {
          operationId: "updateCrmContact",
          summary: "Change a contact's stage, tags or lead details",
          description:
            "Stage and tags for any visible contact. Name, email and phone only for leads (409 NOT_A_LEAD for members, whose identity comes from bookings). A stage change is audited as crm_contact.status_changed, anything else as crm_contact.updated.",
          tags: ["CRM"],
          requestParams: {
            path: z.object({ contactId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: UpdateCrmContactRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Contact",
              content: { "application/json": { schema: CrmContactSchema } },
            },
            "409": {
              description: "Identity fields sent for a member contact",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/crm/follow-ups": {
        get: {
          operationId: "listCrmFollowUps",
          summary: "List the caller's follow-ups",
          description:
            "Open follow-ups by default, soonest due first. Notes are decrypted in the expert org. Only the author sees a follow-up.",
          tags: ["CRM"],
          requestParams: { query: ListCrmFollowUpsQuerySchema },
          responses: {
            ...stdErrors,
            "200": {
              description: "Follow-ups",
              content: {
                "application/json": { schema: ListCrmFollowUpsResponseSchema },
              },
            },
          },
        },
        post: {
          operationId: "createCrmFollowUp",
          summary: "Schedule a follow-up on a contact",
          description:
            "The contact must exist (create a member's row first with POST /crm/contacts). The note is encrypted with the org key. Audited as crm_follow_up.created.",
          tags: ["CRM"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: CreateCrmFollowUpRequestSchema },
            },
          },
          responses: {
            ...stdWithNotFound,
            "201": {
              description: "Follow-up",
              content: { "application/json": { schema: CrmFollowUpSchema } },
            },
          },
        },
      },
      "/crm/follow-ups/{followUpId}/done": {
        post: {
          operationId: "completeCrmFollowUp",
          summary: "Mark a follow-up done",
          description:
            "Author only. Completing a done follow-up returns it unchanged. Audited as crm_follow_up.status_changed.",
          tags: ["CRM"],
          requestParams: {
            path: z.object({ followUpId: z.string().uuid() }),
          },
          requestBody: emptyRequestBody,
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Follow-up",
              content: { "application/json": { schema: CrmFollowUpSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/documents": {
        get: {
          operationId: "listSessionDocuments",
          summary: "List session documents for a booking",
          description:
            "Assigned expert lists all non-deleted documents. Member lists only scope=shared. Filenames are decrypted in the expert org. Bytes stay in the private Blob store. Not HIPAA.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Session documents",
              content: {
                "application/json": {
                  schema: ListSessionDocumentsResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller is not the assigned expert or member",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
        post: {
          operationId: "completeSessionDocument",
          summary: "Persist metadata after a private Blob upload",
          description:
            "Assigned expert or booking member. Pathname must start with records/<expertOrgId>/<memberUserId>/<actorUserId>/. The API looks up the private Blob by pathname and stores the store's url, MIME, and size — not client-supplied values. Members always persist scope=shared. Audit payload is bookingId + scope (no filename).",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CompleteSessionDocumentRequestSchema,
              },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Persisted document metadata",
              content: {
                "application/json": {
                  schema: CompleteSessionDocumentResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller cannot upload, or member set expert_only",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "A document already exists at this pathname",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "422": {
              description: "Pathname, MIME, or size failed validation",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/documents/upload-token": {
        post: {
          operationId: "mintSessionDocumentUploadToken",
          summary: "Mint a private Blob client-upload token",
          description:
            "Vercel Blob handleUpload protocol. Token is bound to the private store and pathname prefix records/<expertOrgId>/<memberUserId>/<actorUserId>/. Not form-data.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({ bookingId: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({}).passthrough(),
              },
            },
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Blob client-upload token payload",
              content: {
                "application/json": {
                  schema: z.object({}).passthrough(),
                },
              },
            },
            "400": {
              description: "Pathname rejected",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/documents/{documentId}/url": {
        get: {
          operationId: "mintSessionDocumentUrl",
          summary: "Mint a short-lived download URL",
          description:
            "Assigned expert, or member when scope=shared. URL expires in 15 minutes and is audited. Direct private Blob URLs return 403.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              documentId: z.string().uuid(),
            }),
          },
          responses: {
            ...stdWithNotFound,
            "200": {
              description: "Signed download URL",
              content: {
                "application/json": {
                  schema: SessionDocumentUrlResponseSchema,
                },
              },
            },
            "403": {
              description: "Caller cannot read this document",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/documents/{documentId}": {
        delete: {
          operationId: "deleteSessionDocument",
          summary: "Delete a session document",
          description:
            "Uploader only (D-11). Soft-deletes the row after deleting the private Blob object. A store 404 counts as deleted.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              documentId: z.string().uuid(),
            }),
          },
          responses: {
            ...stdWithNotFound,
            "204": {
              description: "Deleted",
            },
            "403": {
              description: "Caller is not the uploader",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/sessions/{bookingId}/documents/{documentId}/download": {
        get: {
          operationId: "downloadSessionDocument",
          summary: "Stream a session document with a short-lived grant",
          security: [],
          description:
            "Grant from GET .../url. Expires in 15 minutes. Rate-limited at RATE_LIMITS.public.",
          tags: ["Sessions"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
              documentId: z.string().uuid(),
            }),
            query: z.object({ g: z.string().min(1) }),
          },
          responses: {
            "200": {
              description: "Private document bytes",
              content: {
                "application/pdf": { schema: z.any() },
                "image/jpeg": { schema: z.any() },
                "image/png": { schema: z.any() },
                "image/webp": { schema: z.any() },
              },
            },
            "410": {
              description: "Grant missing or expired",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/webhooks/daily": {
        post: {
          operationId: "dailyWebhook",
          summary: "Daily webhook receiver",
          description:
            "HMAC of timestamp.body. Idempotent by event id and ordered by event_ts. Applies meeting.started/ended and participant.joined/left. Standard Daily, recording off, not HIPAA.",
          tags: ["Webhooks"],
          security: [],
          parameters: [
            {
              name: "x-webhook-timestamp",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "x-webhook-signature",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({}).passthrough(),
              },
            },
          },
          responses: {
            "200": {
              description: "Event accepted (processed, duplicate, or ignored)",
              content: {
                "application/json": { schema: DailyWebhookResponseSchema },
              },
            },
            "401": {
              description: "Missing or invalid HMAC",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description: "Retryable handler failure",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/me/notification-preferences": {
        put: {
          operationId: "putMeNotificationPreferences",
          summary: "Upsert the authenticated member's notification preferences",
          description:
            "Upserts channel/category enabled flags. quietHoursStart and quietHoursEnd must both be set or both be null. Each channel/category pair must be unique. Timezone and quiet hours apply to every preference row for the member.",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: PutNotificationPreferencesRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Updated preferences",
              content: {
                "application/json": {
                  schema: MeNotificationPreferencesResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/me/reports": {
        get: {
          operationId: "listMeReports",
          summary: "List session reports experts have published to me",
          description:
            "Published kind=report records across the member's bookings, newest first, decrypted per expert org. Internal reports, notes and transcripts are never returned.",
          tags: ["Me"],
          responses: {
            "200": {
              description: "Published session reports",
              content: {
                "application/json": { schema: ListMeReportsResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/me/consents": {
        get: {
          operationId: "listMeConsents",
          summary: "List consent status for every kind",
          tags: ["Me"],
          responses: {
            "200": {
              description: "Consent kinds with version and timestamps",
              content: {
                "application/json": { schema: ListMeConsentsResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
        put: {
          operationId: "putMeConsent",
          summary: "Grant or withdraw one consent kind",
          description:
            "Marketing and ai_processing withdraw immediately. health_data_processing returns 409 while a confirmed future booking exists.",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: PutMeConsentRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Updated consents",
              content: {
                "application/json": { schema: ListMeConsentsResponseSchema },
              },
            },
            "409": {
              description: "health_data_processing still required",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/me/record-access-optouts": {
        get: {
          operationId: "listMeRecordAccessOptouts",
          summary: "List clinic record-sharing opt-outs for the member",
          description:
            "Returns team clinics where the member has booked, with whether the clinic has shared records enabled and whether the member opted out (D-11).",
          tags: ["Me"],
          responses: {
            "200": {
              description: "Clinic choices",
              content: {
                "application/json": {
                  schema: ListMeRecordAccessOptoutsResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
        put: {
          operationId: "putMeRecordAccessOptout",
          summary: "Opt out or back in to clinic shared session records",
          tags: ["Me"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: PutMeRecordAccessOptoutRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Updated choices",
              content: {
                "application/json": {
                  schema: ListMeRecordAccessOptoutsResponseSchema,
                },
              },
            },
            "403": {
              description: "Not eligible for this clinic org",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/me/bookings/{id}/cancellation-quote": {
        get: {
          operationId: "getMeBookingCancellationQuote",
          summary: "Preview the refund for cancelling a member booking now",
          description:
            "Applies the cancellation policy snapshotted on the booking (flexible, moderate or strict, plus the 24h-after-booking grace period). Returns the refund percent and amount, when the full-refund window ends, and when the refund next drops. Returns the same numbers POST /cancel would apply at this instant.",
          tags: ["Me"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          responses: {
            "200": {
              description: "Cancellation quote",
              content: {
                "application/json": { schema: CancellationQuoteSchema },
              },
            },
            "409": {
              description: "Session already started or invalid status",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/me/bookings/{id}/cancel": {
        post: {
          operationId: "cancelMeBooking",
          summary: "Cancel a confirmed member booking",
          description:
            "Allowed until the session starts. Refunds per the booking's cancellation policy snapshot: records refund_due_cents on the payment and, when above 0, marks it refund_pending for the cancellation-refund sweep. Returns the applied quote. Releases the slot.",
          tags: ["Me"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Booking cancelled",
              content: {
                "application/json": { schema: CancelMeBookingResponseSchema },
              },
            },
            "409": {
              description: "Too late or invalid status",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/me/bookings/{id}/reschedule": {
        post: {
          operationId: "rescheduleMeBooking",
          summary: "Reschedule a confirmed member booking",
          description:
            "Allowed only while cancelling would still refund in full under the booking's cancellation policy (and within the service reschedule window, if set). Moves times, releases the old slot, and sends ICS via existing helpers.",
          tags: ["Me"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: RescheduleMeBookingRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Booking rescheduled",
              content: {
                "application/json": {
                  schema: RescheduleMeBookingResponseSchema,
                },
              },
            },
            "409": {
              description: "Too late, invalid status, or slot taken",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/privacy/dsar": {
        post: {
          operationId: "createDsarRequest",
          summary: "Request a member data export",
          description:
            "Creates a pending DSAR and kicks off a private-Blob zip export via QStash. The signed download URL is only returned on GET when status is ready.",
          tags: ["Privacy"],
          requestBody: emptyRequestBody,
          responses: {
            "201": {
              description: "Export requested",
              content: {
                "application/json": {
                  schema: CreateDsarRequestResponseSchema,
                },
              },
            },
            "200": {
              description: "Existing pending export reused",
              content: {
                "application/json": {
                  schema: CreateDsarRequestResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/privacy/dsar/{id}": {
        get: {
          operationId: "getDsarRequest",
          summary: "Get DSAR export status",
          description:
            "downloadUrl is included only when status is ready and the 24h signed URL has not expired.",
          tags: ["Privacy"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          responses: {
            "200": {
              description: "DSAR status",
              content: {
                "application/json": {
                  schema: DsarRequestStatusResponseSchema,
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/privacy/delete-account": {
        post: {
          operationId: "deleteAccount",
          summary: "Schedule member account deletion",
          description:
            "Marks deletion_scheduled_at, cancels future bookings, and flags succeeded payments refund_pending. Stripe refunds are not executed here. 14-day grace.",
          tags: ["Privacy"],
          requestBody: emptyRequestBody,
          responses: {
            "201": {
              description: "Deletion scheduled",
              content: {
                "application/json": { schema: DeleteAccountResponseSchema },
              },
            },
            "409": {
              description: "Deletion already scheduled",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/privacy/cancel-deletion": {
        post: {
          operationId: "cancelAccountDeletion",
          summary: "Cancel a pending account deletion",
          description:
            "Clears deletion_scheduled_at so the member can book again.",
          tags: ["Privacy"],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Deletion cancelled",
              content: {
                "application/json": { schema: CancelDeletionResponseSchema },
              },
            },
            "409": {
              description: "No pending deletion",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/accounting/disconnect": {
        post: {
          operationId: "disconnectAccountingProvider",
          summary: "Disconnect the expert invoicing provider",
          description:
            "Deletes the expert's stored invoicing credentials and returns invoicing setup to not_started so a provider or manual invoicing must be chosen again. Issued documents and invoice rows are untouched. Returns disconnected=false when no provider is set.",
          tags: ["Accounting"],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Disconnect outcome",
              content: {
                "application/json": {
                  schema: DisconnectAccountingResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing expert:invoicing_manage or BotID blocked",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/accounting/connect/{provider}": {
        post: {
          operationId: "connectAccountingProvider",
          summary: "Start invoicing provider OAuth",
          description:
            "Returns the TOConline or Moloni authorization URL. Uses the proven simplified Authorization Code flow (no PKCE). The callback state is a one-time nonce bound to the expert session.",
          tags: ["Accounting"],
          requestParams: {
            path: z.object({
              provider: z.enum(["toconline", "moloni"]),
            }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Authorization URL",
              content: {
                "application/json": {
                  schema: ConnectAccountingResponseSchema,
                },
              },
            },
            "403": {
              description: "Provider flag disabled or BotID blocked",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "502": {
              description:
                "Provider URL generation failed or retryable adapter error",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "503": {
              description: "Fatal adapter failure",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/accounting/reconciliation": {
        get: {
          operationId: "getAccountingReconciliation",
          summary: "Read Stripe vs expert invoice reconciliation",
          description:
            "Staff-only. Returns the latest monthly run, or a specific Lisbon calendar month. Compares booking payments to expert_invoices. Does not POST TOConline sales documents. Tier 1 platform-fee comparison is skipped until 07.1.",
          tags: ["Accounting"],
          requestParams: {
            query: GetAccountingReconciliationQuerySchema,
          },
          responses: {
            "200": {
              description: "Reconciliation run",
              content: {
                "application/json": {
                  schema: GetAccountingReconciliationResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing accounting:reconcile",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/invoicing/platform-fee": {
        get: {
          operationId: "listPlatformFeeInvoices",
          summary: "List Eleva → expert platform-fee invoices",
          description:
            "Staff read of Tier 1 platform-fee invoice rows for a Lisbon calendar month. Does not POST TOConline v1 sales documents and does not Comunicar série. Live issuance stays closed.",
          tags: ["Invoicing"],
          requestParams: {
            query: ListPlatformFeeInvoicesQuerySchema,
          },
          responses: {
            "200": {
              description: "Platform-fee invoice list",
              content: {
                "application/json": {
                  schema: ListPlatformFeeInvoicesResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing accounting:reconcile",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
        post: {
          operationId: "issuePlatformFeeInvoice",
          summary: "Record a closed-gate platform-fee invoice",
          description:
            "Staff/agent replay of issuePlatformFeeInvoice. Classifies IVA conservatively, may GET tax lookups, and records blocked, skipped, or retryable pending. On a new row it also inserts a domain_events_outbox event (invoice.blocked | invoice.skipped | invoice.pending) for Phase 8 notifications. Never POSTs /api/v1/commercial_sales_documents, never Comunica série, and never emits invoice.issued or invoice.failed.",
          tags: ["Invoicing"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: IssuePlatformFeeInvoiceRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description:
                "Closed-gate invoice outcome plus the outbox event ref when a row was written",
              content: {
                "application/json": {
                  schema: IssuePlatformFeeInvoiceResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing accounting:reconcile",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/invoicing/platform-fee/{id}/retry": {
        post: {
          operationId: "retryPlatformFeeInvoice",
          summary: "Retry one platform-fee invoice row",
          description:
            "Staff replay of a pending, failed, blocked, skipped, or dead-lettered platform-fee row. Resets it to pending under an audited compare-and-set, then re-runs closed-gate classification; restores the prior state if nothing was recorded. Issued, credited, and D-09 legacy rows are final. Never POSTs /api/v1/commercial_sales_documents and never Comunica série.",
          tags: ["Invoicing"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
          },
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Closed-gate invoice outcome after the retry",
              content: {
                "application/json": {
                  schema: IssuePlatformFeeInvoiceResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing accounting:reconcile or flag disabled",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Row is final or changed during the retry",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/invoicing/expert": {
        get: {
          operationId: "listExpertInvoices",
          summary: "List expert → member invoices",
          description:
            "Returns the authenticated expert organization's Tier 2 invoices. Does not include member tax IDs. Automatic TOConline issuance stays closed until fiscal parameters are signed.",
          tags: ["Invoicing"],
          requestParams: {
            query: ListExpertInvoicesQuerySchema,
          },
          responses: {
            "200": {
              description: "Invoice list",
              content: {
                "application/json": {
                  schema: ListExpertInvoicesResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing expert:invoicing_manage",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/invoicing/expert/{bookingId}/retry": {
        post: {
          operationId: "retryExpertInvoice",
          summary: "Retry a failed expert invoice dispatch",
          description:
            "Re-runs closed-gate adapter dispatch for a failed invoice after an exclusive pending claim. Does not POST TOConline v1 sales documents. Manual invoices cannot be retried — use mark-manual.",
          tags: ["Invoicing"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ExpertInvoiceActionRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Updated invoice",
              content: {
                "application/json": {
                  schema: ExpertInvoiceActionResponseSchema,
                },
              },
            },
            "403": {
              description: "Flag disabled or BotID blocked",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Invoice is not retryable",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/invoicing/expert/{bookingId}/mark-manual": {
        post: {
          operationId: "markExpertInvoiceManual",
          summary: "Mark an expert invoice as issued manually",
          description:
            "Records that the expert issued a certified invoice to the member outside Eleva. Does not create a TOConline document.",
          tags: ["Invoicing"],
          requestParams: {
            path: z.object({
              bookingId: z.string().uuid(),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ExpertInvoiceActionRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Updated invoice",
              content: {
                "application/json": {
                  schema: ExpertInvoiceActionResponseSchema,
                },
              },
            },
            "403": {
              description: "Flag disabled or BotID blocked",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "409": {
              description: "Invoice is already issued",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/invoicing/exports/saft": {
        get: {
          operationId: "exportSaft",
          summary: "Build a monthly CSV + SAF-T PT skeleton zip",
          description:
            "Uploads a private zip of the expert organization's invoices for the Lisbon calendar month. The XML is a ledger skeleton, not a certified AT file, and is not submitted or Comunicado. Does not POST TOConline sales documents.",
          tags: ["Invoicing"],
          requestParams: {
            query: ExportSaftQuerySchema,
          },
          responses: {
            "200": {
              description: "Signed download metadata",
              content: {
                "application/json": {
                  schema: ExportSaftResponseSchema,
                },
              },
            },
            "403": {
              description: "Missing expert:invoicing_manage",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdErrors,
          },
        },
      },
      "/invoicing/exports/saft/file": {
        get: {
          operationId: "downloadSaftExport",
          summary: "Download a signed monthly SAF-T zip",
          description:
            "Streams the private zip created by exportSaft. Requires expert:invoicing_manage and a token bound to the active organization.",
          tags: ["Invoicing"],
          requestParams: {
            query: ExportSaftFileQuerySchema,
          },
          responses: {
            "200": {
              description: "Zip attachment",
              content: {
                "application/zip": {
                  schema: z.string().meta({ format: "binary" }),
                },
              },
            },
            "403": {
              description: "Missing expert:invoicing_manage",
              content: { "application/json": { schema: ErrorSchema } },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/workflows/booking-reminder": {
        post: {
          operationId: "deliverBookingReminder",
          summary: "Send a scheduled booking reminder",
          description:
            "Internal QStash handler for T-24h and T-1h reminders. Re-checks that the booking is still confirmed or rescheduled and that startsAt still matches before sendNotification. Cancel does not delete the delayed message. Auth is WORKFLOWS_DRAIN_SECRET.",
          tags: ["Workflows"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: BookingReminderRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description:
                "Reminder processed or skipped after status re-check",
              content: {
                "application/json": {
                  schema: BookingReminderResponseSchema,
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
              description: "Internal workflow rate limit exceeded",
              content: {
                "application/json": { schema: RateLimitErrorSchema },
              },
            },
            "500": {
              description: "Reminder delivery failed after status re-check",
              content: {
                "application/json": { schema: ErrorSchema },
              },
            },
          },
        },
      },
      "/notifications": {
        get: {
          operationId: "listInbox",
          summary: "List in-app inbox notifications",
          description:
            "Returns the current member's inbox rows for the active organization (RLS owner SELECT). Pass unread=true to filter unread. Always includes unreadCount.",
          tags: ["Notifications"],
          parameters: [
            {
              name: "unread",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["true", "1", "false", "0"] },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100 },
            },
          ],
          responses: {
            "200": {
              description: "Inbox items and unread count",
              content: {
                "application/json": { schema: ListInboxResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/notifications/{id}/read": {
        post: {
          operationId: "markInboxRead",
          summary: "Mark one inbox notification as read",
          description:
            "Owner UPDATE via RLS. Idempotent when already read. Emits notification.updated.",
          tags: ["Notifications"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Notification marked read",
              content: {
                "application/json": { schema: MarkInboxReadResponseSchema },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/notifications/read-all": {
        post: {
          operationId: "markInboxReadAll",
          summary: "Mark all inbox notifications as read",
          description:
            "Owner UPDATE for every unread row belonging to the session user. Emits inbox.updated.",
          tags: ["Notifications"],
          requestBody: emptyRequestBody,
          responses: {
            "200": {
              description: "Unread rows marked read",
              content: {
                "application/json": { schema: MarkInboxReadAllResponseSchema },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/ai/session-report": {
        get: {
          operationId: "getSessionReportDraftStatus",
          summary: "AI session report draft status",
          tags: ["AI"],
          requestParams: {
            query: z.object({ bookingId: z.string().uuid() }),
          },
          responses: {
            "200": {
              description: "Latest ai_draft record for the booking (if any)",
              content: {
                "application/json": {
                  schema: SessionReportDraftStatusResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
        post: {
          operationId: "draftSessionReport",
          summary: "Generate an AI session report draft from typed notes",
          description:
            "Expert only. Requires ff.ai_reports_beta, member ai_processing consent, and zero-retention model on the allow-list. Never auto-publishes.",
          tags: ["AI"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: SessionReportDraftRequestSchema,
              },
            },
          },
          responses: {
            "200": {
              description: "Encrypted unpublished ai_draft record",
              content: {
                "application/json": {
                  schema: SessionReportDraftResponseSchema,
                },
              },
            },
            ...stdErrors,
          },
        },
      },
      "/ai/editor": {
        post: {
          operationId: "editorAssist",
          summary: "Stream Plate editor writing assistance",
          description:
            "Expert-session only. Streams plain-text revisions for improve / shorten / fix_grammar / translate. Context `clinical` is rejected until Phase 10. Rate limit 30/hour/org. Logs tokens/latency only — never prompt content.",
          tags: ["AI"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: EditorAssistRequestSchema,
              },
            },
          },
          responses: {
            ...stdErrors,
            "200": {
              description: "UTF-8 text stream of the assisted draft",
              content: {
                "text/plain": {
                  schema: z.string(),
                },
              },
            },
            "403": {
              description:
                "Missing capability or clinical context rejected (Phase 10)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "404": {
              description: "Expert profile or resource not found for this org",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "422": {
              description: "Validation error on request body",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "429": {
              description: "Editor AI rate limit (30/hour/org)",
              content: {
                "application/json": { schema: RateLimitErrorSchema },
              },
            },
            "503": {
              description:
                "AI_GATEWAY_MODEL_EDITOR missing or not on allow-list",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/accounting/callback": {
        get: {
          operationId: "accountingOAuthCallback",
          summary: "Invoicing provider OAuth callback",
          description:
            "Browser redirect target after the expert authorizes TOConline. Verifies the signed state nonce bound to the session, exchanges the code, stores the encrypted credential, then 302-redirects to expert setup or onboarding with a status query. Requires the session cookie.",
          tags: ["Accounting"],
          security: [{ cookieAuth: [] }],
          requestParams: {
            query: z.object({
              code: z.string().optional(),
              state: z.string().optional(),
              error: z.string().optional(),
            }),
          },
          responses: {
            "302": {
              description:
                "Redirect to setup/onboarding (success or error query), or to login without a session",
            },
            "429": {
              description: "Rate limit exceeded",
              content: { "application/json": { schema: RateLimitErrorSchema } },
            },
          },
        },
      },
      "/accounting/status": {
        get: {
          operationId: "getAccountingStatus",
          summary: "Expert invoicing connection status",
          description:
            "Returns the expert's invoicing provider and setup status, and a live adapter probe when connected to a non-manual provider.",
          tags: ["Accounting"],
          responses: {
            "200": {
              description: "Current status",
              content: {
                "application/json": {
                  schema: z.object({
                    provider: z.string().nullable(),
                    setupStatus: z.string(),
                    adapterStatus: z
                      .object({ status: z.string() })
                      .catchall(z.unknown())
                      .nullable(),
                  }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/blob/upload": {
        post: {
          operationId: "handleBlobUpload",
          summary: "Vercel Blob client-upload handshake",
          description:
            "Implements the @vercel/blob client-upload protocol (token generation and upload-completed callback). Auth is a short-lived upload token in Authorization: Bearer, minted for the signed-in user; the pathname must match an allowed upload policy.",
          tags: ["Users"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  type: z.enum([
                    "blob.generate-client-token",
                    "blob.upload-completed",
                  ]),
                  payload: z.record(z.string(), z.unknown()),
                }),
              },
            },
          },
          responses: {
            "200": {
              description: "Client token or completion acknowledgement",
              content: {
                "application/json": {
                  schema: z.record(z.string(), z.unknown()),
                },
              },
            },
            "400": {
              description: "Upload rejected (bad token, pathname or payload)",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "429": {
              description: "Rate limit exceeded",
              content: { "application/json": { schema: RateLimitErrorSchema } },
            },
          },
        },
      },
      "/privacy/dsar/{id}/file": {
        get: {
          operationId: "downloadDsarExport",
          summary: "Download a ready data export",
          description:
            "Streams the member's private DSAR zip. Requires the owner's session and a signed, unexpired link (exp + sig). Any mismatch returns 404.",
          tags: ["Privacy"],
          requestParams: {
            path: z.object({ id: z.string().uuid() }),
            query: z.object({ exp: z.string(), sig: z.string() }),
          },
          responses: {
            "200": {
              description: "Zip attachment",
              content: {
                "application/zip": {
                  schema: z.string().meta({ format: "binary" }),
                },
              },
            },
            ...stdWithNotFound,
          },
        },
      },
      "/cron/keep-alive": cronProbe({
        operationId: "cronKeepAlive",
        summary: "Database keep-alive probe",
        description:
          "Pings the main and audit databases and sends a heartbeat when both answer.",
      }),
      "/cron/booking-probes": cronProbe({
        operationId: "cronBookingProbes",
        summary: "Booking funnel synthetic probes",
        description:
          "Runs read-only probes against the public booking funnel and reports failures.",
      }),
      "/workflows/account-deletion-sweep": internalWorkflow({
        operationId: "sweepAccountDeletions",
        summary: "Complete due account deletions",
        description:
          "Finishes deletions past their grace period, cancelling open PaymentIntents first.",
      }),
      "/workflows/audit-outbox-drainer": internalWorkflow({
        operationId: "drainAuditOutbox",
        summary: "Ship audit outbox rows",
        description:
          "Moves audit_outbox rows to the append-only audit_events store.",
      }),
      "/workflows/check-upcoming-payouts": internalWorkflow({
        operationId: "checkUpcomingPayouts",
        summary: "Count payouts due in 48 hours",
        description: "Reports payouts scheduled within the next 48 hours.",
      }),
      "/workflows/domain-events-publisher": internalWorkflow({
        operationId: "publishDomainEvents",
        summary: "Publish pending domain events",
        description:
          "Delivers pending domain events to the default subscribers (guest activation, notifications).",
      }),
      "/workflows/dsar-export": internalWorkflow({
        operationId: "processDsarExport",
        summary: "Build a member data export",
        description:
          "Builds the DSAR zip into private storage. Returns 500 with dsar_export_in_progress while another run holds the job.",
        requestSchema: DsarExportWorkflowRequestSchema,
        requestRequired: true,
      }),
      "/workflows/invoicing-retry": internalWorkflow({
        operationId: "retryFailedInvoices",
        summary: "Retry failed expert invoices",
        description:
          "Re-dispatches failed expert invoices. The issuance gate stays closed, so retries record skipped/blocked and never post commercial documents.",
      }),
      "/workflows/process-expert-transfers": internalWorkflow({
        operationId: "processExpertTransfers",
        summary: "Run due expert transfers",
        description:
          "Processes pending cancellation refunds, retries failed transfer reversals, then transfers due payouts.",
      }),
      "/workflows/process-pending-payouts": internalWorkflow({
        operationId: "processPendingPayouts",
        summary: "Promote eligible pending payouts",
        description: "Promotes pending payouts whose eligibleAt has passed.",
      }),
      "/workflows/kek-rotation": internalWorkflow({
        operationId: "rotateKeks",
        summary: "Re-wrap org data keys under the current KEK",
        description:
          "On-demand ADR-020 KEK rotation. Re-wraps DEKs only, never ciphertext. Dry run unless apply is true; hasMore means call again.",
        requestSchema: KekRotationWorkflowRequestSchema,
      }),
      "/workflows/crm-follow-up-due": internalWorkflow({
        operationId: "notifyDueCrmFollowUps",
        summary: "Notify authors of due CRM follow-ups",
        description:
          "Hourly in-app digest of open follow-ups past dueAt. One digest per author; payload is a count (no names or notes).",
      }),
      "/workflows/retention-sweep": internalWorkflow({
        operationId: "sweepRetention",
        summary: "Daily retention sweep",
        description:
          "Purges unpublished AI drafts (90d), expired session documents (private Blob then row), and notification delivery logs (1y). Batched; hasMore means the next run continues.",
      }),
      "/workflows/slot-reservation-expiry": internalWorkflow({
        operationId: "expireSlotReservations",
        summary: "Expire lapsed slot holds",
        description:
          "Expires lapsed holds, cancelling still-cancelable PaymentIntents first and keeping holds whose payment can still settle.",
      }),
      "/workflows/booking-request-expiry": internalWorkflow({
        operationId: "expireBookingRequests",
        summary: "Expire unanswered Request to book rows",
        description:
          "Every minute: cancel awaiting_confirmation bookings past approval_deadline_at (24 hours or session start). Full refund and slot release. Does not create a session or guest login.",
      }),
      "/workflows/stripe-stuck-events": internalWorkflow({
        operationId: "detectStuckStripeEvents",
        summary: "Detect stuck Stripe webhook events",
        description:
          "Reports stripe_webhook_events rows stuck in received or processing past their threshold.",
      }),
      "/workflows/stripe-toconline-reconciliation": internalWorkflow({
        operationId: "reconcileStripeToconline",
        summary: "Monthly Stripe vs invoices reconciliation",
        description:
          "Compares Stripe booking payments with expert invoices for a Lisbon month (default: previous month). Never posts to TOConline.",
        requestSchema: ReconciliationWorkflowRequestSchema,
      }),
      "/workflows/video-room-sweep": internalWorkflow({
        operationId: "sweepMissingSessionRooms",
        summary: "Create missing and delete expired Daily session rooms",
        description:
          "Creates Daily rooms for confirmed or rescheduled online bookings that start within 2 hours and still have no room. Phone and in-person bookings are never included. Also deletes rooms whose join window (booked end + 30 min) closed over an hour ago; the room name stays on the session so late webhooks still map. Standard Daily, recording off, not HIPAA.",
      }),
      "/workflows/video-eject-retry": internalWorkflow({
        operationId: "retryPendingSessionEjects",
        summary: "Retry Daily ejects for revoked delegates",
        description:
          "Ejects and bans revoked session participants that still have no ejected_at, then re-syncs Daily room capacity for scheduled and live rooms.",
      }),
      "/workflows/video-attendance-sweep": internalWorkflow({
        operationId: "sweepEndedSessionsWithoutAttendance",
        summary: "Finalize attendance when Daily sent no meeting.ended",
        description:
          "Sessions still scheduled, live, or room_unresolved with null attendance whose Eleva join window (endsAt + 30m) has closed are finalized from participant history (empty history is nobody / no_show). Attendance only — no refund decision. Standard Daily, not HIPAA.",
      }),
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
          name: "better-auth.session_token",
          description:
            "Better Auth session cookie (`better-auth.session_token` or `__Secure-better-auth.session_token`)",
        },
      },
      schemas: {
        ClosedGateInvoicePayload: ClosedGateInvoicePayloadSchema,
      },
    },
  })
}
