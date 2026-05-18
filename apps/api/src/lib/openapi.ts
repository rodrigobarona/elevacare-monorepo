import { createDocument } from "zod-openapi"
import { z } from "zod"

const ErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
  message: z.string().optional(),
})

const RateLimitErrorSchema = z.object({
  error: z.literal("rate_limit_exceeded"),
  retryAfter: z.number(),
})

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
      "/organizations": {
        post: {
          operationId: "createOrganization",
          summary: "Create an organization",
          tags: ["Organizations"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: z.object({
                  name: z.string().min(2).max(100),
                  type: z
                    .enum(["personal", "expert", "team", "staff"])
                    .default("personal"),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Organization created",
              content: {
                "application/json": {
                  schema: z.object({
                    orgId: z.string().uuid(),
                    slug: z.string(),
                    workosOrgId: z.string(),
                    created: z.boolean(),
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
