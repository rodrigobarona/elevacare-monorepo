import { apiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { nextCookies, toNextJsHandler } from "better-auth/next-js"
import {
  admin,
  bearer,
  jwt,
  magicLink,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins"
import { Redis } from "@upstash/redis"
import * as authSchema from "@eleva/db/schema/auth"
import { db } from "@eleva/db"
import { ac, adminAccess, adminRoles, organizationRoles } from "../permissions"
import { provisionPersonalSpace } from "../provision-personal-space"
import {
  sendMagicLinkEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "../send-auth-email"
import { sendAuthEmail } from "@eleva/email"
import { isTrustedOrigin, trustedOrigins } from "../trusted-origins"
import { authRateLimitEnabled } from "../e2e-auth-url"
import { invitationAcceptUrl } from "../invitation-accept-url"
import { crossSubDomainCookieConfig } from "./cookie-domain"

function requireSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required")
  }
  return secret
}

function baseURL(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3002/auth"
}

function secondaryStorage() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return undefined

  const redis = new Redis({ url, token })
  return {
    get: async (key: string) => {
      const value = await redis.get<string>(key)
      return value ?? null
    },
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await redis.set(key, value, { ex: ttl })
        return
      }
      await redis.set(key, value)
    },
    delete: async (key: string) => {
      await redis.del(key)
    },
    getAndDelete: async (key: string) => {
      const value = await redis.get<string>(key)
      await redis.del(key)
      return value ?? null
    },
    increment: async (key: string) => redis.incr(key),
  }
}

function socialProviders() {
  const googleId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const googleSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const microsoftId = process.env.MICROSOFT_OAUTH_CLIENT_ID
  const microsoftSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET

  return {
    ...(googleId && googleSecret
      ? {
          google: {
            clientId: googleId,
            clientSecret: googleSecret,
            accessType: "offline" as const,
            prompt: "consent" as const,
          },
        }
      : {}),
    ...(microsoftId && microsoftSecret
      ? {
          microsoft: {
            clientId: microsoftId,
            clientSecret: microsoftSecret,
            tenantId: "common",
          },
        }
      : {}),
  }
}

function requireSecondaryStorageWhenDeployed(
  storage: ReturnType<typeof secondaryStorage>
): void {
  const deployed =
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "production"
  if (deployed && !storage) {
    throw new Error(
      "KV_REST_API_URL and KV_REST_API_TOKEN are required in production and preview so Better Auth rate limits stay on"
    )
  }
}

function createAuth() {
  const storage = secondaryStorage()
  requireSecondaryStorageWhenDeployed(storage)
  const issuer = baseURL()

  // Plugin packages resolve a second @better-auth/core copy; the runtime
  // contract is 1.7.3. Cast keeps tsc aligned with the spike-proven set.
  return betterAuth({
    appName: "Eleva.care",
    baseURL: issuer,
    basePath: "/auth",
    secret: requireSecret(),
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string; name?: string | null }
        url: string
      }) => {
        await sendResetPasswordEmail({ user, url })
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string; name?: string | null }
        url: string
      }) => {
        await sendVerificationEmail({ user, url })
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },
    verification: {
      // Secondary storage alone hides tokens from Neon. Keep a hashed DB
      // copy so support can still complete verify / reset / magic-link.
      storeInDatabase: true,
      storeIdentifier: "hashed",
    },
    socialProviders: socialProviders(),
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        trustedProviders: ["google"],
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 300 },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      crossSubDomainCookies: crossSubDomainCookieConfig(),
      useSecureCookies: process.env.NODE_ENV === "production",
      database: { generateId: "uuid" },
    },
    trustedOrigins: trustedOrigins(),
    rateLimit: {
      enabled: authRateLimitEnabled(Boolean(storage)),
      storage: "secondary-storage",
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user: { id: string; name?: string | null }) => {
            await provisionPersonalSpace({
              id: user.id,
              name: user.name,
            })
          },
        },
      },
    },
    user: {
      additionalFields: {
        timezone: {
          type: "string",
          required: false,
          input: true,
        },
        locale: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles: organizationRoles,
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        membershipLimit: 200,
        schema: {
          organization: {
            additionalFields: {
              type: {
                type: "string",
                required: true,
                defaultValue: "personal",
                input: true,
              },
            },
          },
        },
        sendInvitationEmail: async (data: {
          email: string
          invitation: { id: string }
        }) => {
          await sendAuthEmail({
            kind: "organization-invitation",
            to: data.email,
            url: invitationAcceptUrl(data.invitation.id),
          })
        },
        organizationHooks: {
          afterAddMember: async ({
            organization,
          }: {
            organization: { id: string }
          }) => {
            enqueueTeamSeatSync(organization.id)
          },
          afterRemoveMember: async ({
            organization,
          }: {
            organization: { id: string }
          }) => {
            enqueueTeamSeatSync(organization.id)
          },
          afterAcceptInvitation: async ({
            organization,
          }: {
            organization: { id: string }
          }) => {
            enqueueTeamSeatSync(organization.id)
          },
        },
      }),
      admin({
        ac: adminAccess as never,
        roles: adminRoles,
        defaultRole: "user",
        adminRoles: ["platform_admin"],
      }),
      twoFactor({
        issuer: "Eleva.care",
        sendOTP: async ({
          user,
          otp,
        }: {
          user: { email: string; name?: string | null }
          otp: string
        }) => {
          await sendAuthEmail({
            kind: "two-factor-otp",
            to: user.email,
            name: user.name ?? undefined,
            code: otp,
          })
        },
      }),
      passkey({
        rpID: process.env.PASSKEY_RP_ID ?? "eleva.care",
        rpName: "Eleva.care",
        origin: process.env.PASSKEY_ORIGIN ?? issuer,
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail({ email, url })
        },
      }),
      bearer(),
      jwt({
        jwt: {
          expirationTime: "15m",
          issuer,
          audience: issuer,
          definePayload: ({ user, session }) => ({
            orgId:
              "activeOrganizationId" in session
                ? session.activeOrganizationId
                : null,
            role: "role" in user ? user.role : "user",
          }),
        },
        jwks: {
          keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
        },
      }),
      apiKey({ enableMetadata: true }),
      openAPI({ path: "/reference", disableDefaultReference: true }),
      nextCookies(),
    ],
    secondaryStorage: storage,
  } as never)
}

export interface AuthApi {
  getSession: (opts: { headers: Headers }) => Promise<{
    session: {
      id: string
      userId: string
      token: string
      activeOrganizationId?: string | null
    }
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role?: string
    }
  } | null>
  createOrganization: (opts: {
    body: {
      name: string
      slug: string
      userId: string
      type: string
    }
  }) => Promise<{ id?: string; organization?: { id?: string } } | null>
  addMember: (opts: {
    body: {
      userId: string
      organizationId: string
      role: string
    }
  }) => Promise<unknown>
  setActiveOrganization: (opts: {
    headers: Headers
    body: { organizationId: string }
  }) => Promise<unknown>
  signOut: (opts: { headers: Headers }) => Promise<unknown>
  verifyApiKey: (opts: { body: { key: string } }) => Promise<{
    valid: boolean
    key?: { userId: string; referenceId?: string | null; name?: string | null }
  } | null>
  getAccessToken: (opts: {
    body: { accountId: string; userId?: string }
  }) => Promise<{ accessToken?: string } | null>
  generateOpenAPISchema?: () => Promise<unknown>
  signInMagicLink: (opts: {
    body: { email: string; callbackURL: string }
  }) => Promise<unknown>
}

function enqueueTeamSeatSync(orgId: string): void {
  void import("@eleva/billing/server")
    .then(({ enqueueSeatSync }) => enqueueSeatSync(orgId))
    .catch((error: unknown) => {
      console.error("[auth] team seat sync failed", error)
    })
}

export function getAuthApi(): AuthApi {
  return getAuth().api as unknown as AuthApi
}

export async function requestMagicLinkSignIn(input: {
  email: string
  callbackURL: string
}): Promise<void> {
  const result = await getAuthApi().signInMagicLink({
    body: { email: input.email, callbackURL: input.callbackURL },
  })
  if (
    result &&
    typeof result === "object" &&
    "status" in result &&
    result.status === false
  ) {
    throw new Error("magic link request rejected")
  }
}

let authSingleton: ReturnType<typeof createAuth> | undefined

export function getAuth() {
  if (!authSingleton) authSingleton = createAuth()
  return authSingleton
}

export const auth = {
  get api() {
    return getAuthApi()
  },
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  const origin = request.headers.get("origin")
  if (origin && isTrustedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Credentials", "true")
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  headers.set(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-api-key, x-correlation-id"
  )
  headers.set("Vary", "Origin")
  return headers
}

function withCors(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    const response = await handler(request)
    const headers = corsHeaders(request)
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })
    return response
  }
}

const nextHandlers = {
  GET: (request: Request) => toNextJsHandler(getAuth()).GET(request),
  POST: (request: Request) => toNextJsHandler(getAuth()).POST(request),
}

export const GET = withCors(nextHandlers.GET)
export const POST = withCors(nextHandlers.POST)

export async function betterAuthOpenApiDocument(): Promise<unknown> {
  const generator = getAuthApi().generateOpenAPISchema
  if (!generator) return null
  return generator()
}
