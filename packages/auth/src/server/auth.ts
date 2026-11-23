import { apiKey, type ApiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { i18n, locales } from "@better-auth/i18n"
import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
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
import { resolveGatewayUrl } from "@eleva/config/env"
import { cookieName } from "@eleva/config/i18n"
import { eq } from "drizzle-orm"
import * as authSchema from "@eleva/db/schema/auth"
import { db } from "@eleva/db"
import { ac, adminAccess, adminRoles, organizationRoles } from "../permissions"
import {
  findDefaultOrganizationId,
  provisionPersonalSpace,
} from "../provision-personal-space"
import {
  sendMagicLinkEmail,
  sendOrgInvitationEmail,
  sendResetPasswordEmail,
  sendTwoFactorOtpEmail,
  sendVerificationEmail,
} from "../send-auth-email"
import { isTrustedOrigin, trustedOrigins } from "../trusted-origins"
import { authRateLimitEnabled } from "../e2e-auth-url"
import { logError } from "@eleva/observability"
import { recordInvitationResponse } from "../invitations"
import { invitationAcceptUrl } from "../invitation-accept-url"
import {
  TEAM_INVITATION_TTL_MS,
  TEAM_MEMBER_LIMIT,
  TEAM_MEMBERS_API_REQUIRED,
} from "../team-limits"
import {
  guardAccountLink,
  purgeBeforeClaim,
  refuseImpersonationSession,
  refuseUnverifiedSession,
} from "./account-claim"
import { crossSubDomainCookieConfig } from "./cookie-domain"
import { cookieHeaderHasSession } from "./credentials"
import { magicLinkServerHeaders } from "./magic-link-headers"
import { orgCreateViolation, orgUpdateViolation } from "./org-type-guard"
import {
  EXPERT_PRACTICE_EXISTS,
  secondExpertPracticeViolation,
} from "../expert-practice"
import { PRACTICE_CLOSED } from "@eleva/config/practice-closure"
import {
  closedPracticeViolation,
  sweepClosedPractice,
} from "../practice-closure"
import { passkeyOrigins } from "./passkey-origin"
import { newCredentialVerdict, STEP_UP_REQUIRED } from "./staff-fresh-session"
import {
  AUTH_IP_ADDRESS_HEADERS,
  createSecondaryStorage,
  type AuthSecondaryStorage,
} from "./secondary-storage"
import {
  AUTH_RATE_LIMIT_DEFAULT,
  AUTH_RATE_LIMIT_RULES,
} from "./rate-limit-rules"
import { RATE_LIMITED_CODE } from "../rate-limited"

export { setAuthTransactionalMailer } from "../send-auth-email"

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
  storage: AuthSecondaryStorage | undefined
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

/**
 * The key plugin's options. Its own limit (10 verifications a day for each
 * key, copied onto every key it creates) is off: the API already limits
 * each caller through `RATE_LIMITS`, and ten calls a day would stop an agent
 * before lunch.
 */
const API_KEY_OPTIONS = {
  enableMetadata: true,
  rateLimit: { enabled: false },
} as const

/**
 * What a test replaces to run this very configuration without Postgres.
 * Production passes nothing.
 */
export interface AuthTestSeam {
  /** A Better Auth database adapter, e.g. the in-memory one. */
  database: unknown
  /** Plugins added after Eleva's own, e.g. Better Auth's test utilities. */
  plugins?: unknown[]
  /**
   * A store in place of Redis. Given one, the rate limiter is on, so a
   * test can drive the very rules production uses.
   */
  secondaryStorage?: AuthSecondaryStorage
}

/**
 * The real configuration on another database, for tests. `databaseHooks`
 * are left out: they provision and audit in Postgres. Never in a deployed
 * app: with test plugins it could sign in as anyone.
 */
export function createAuthForTest(seam: AuthTestSeam) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) {
    throw new Error("createAuthForTest is for tests only")
  }
  return createAuth(seam)
}

function createAuth(seam?: AuthTestSeam) {
  // The request hook asks this instance about a bearer session; it is set
  // just below, once the instance exists.
  const self: { getSession?: AuthApi["getSession"] } = {}
  const storage = seam?.secondaryStorage ?? createSecondaryStorage()
  requireSecondaryStorageWhenDeployed(storage)
  const issuer = baseURL()
  const passkeyOrigin = passkeyOrigins()

  // Plugin packages resolve a second @better-auth/core copy; the runtime
  // contract is 1.7.18. Cast keeps tsc aligned with the spike-proven set;
  // account-claim-wiring.test.ts checks the options it cannot type-check.
  const instance = betterAuth({
    appName: "Eleva.care",
    baseURL: issuer,
    basePath: "/auth",
    secret: requireSecret(),
    // A sign-in or account link that fails after the provider (an expired
    // or doubled callback, a refused link) lands on Eleva's own page with
    // `?error=<code>`, not Better Auth's bare error screen on the API host.
    onAPIError: { errorURL: `${resolveGatewayUrl()}/callback` },
    database:
      seam?.database ??
      drizzleAdapter(db(), {
        provider: "pg",
        schema: authSchema,
      }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // A reset is often the answer to a stolen password: sign out every
      // other device too.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: {
          id?: string
          email: string
          name?: string | null
          locale?: string | null
        }
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
        user: {
          id?: string
          email: string
          name?: string | null
          locale?: string | null
        }
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
      // Cookie strategy keeps OAuth PKCE/state on the browser round-trip so Fluid
      // multi-region + Redis verification races cannot drop the callback state.
      storeStateStrategy: "cookie",
      accountLinking: {
        enabled: true,
        // Implicit same-email linking stays on only so a Google-verified email
        // can claim an unverified row (guest-activation, pending verify);
        // `purgeBeforeClaim` wipes what was enrolled before verification.
        // Verified rows are refused by `guardAccountLink` unless the owner is
        // signed in, so takeover-by-email-domain cannot attach Google.
        disableImplicitLinking: false,
        requireLocalEmailVerified: false,
        // Microsoft is trusted for *linking* so a signed-in expert can connect
        // Outlook: personal Microsoft accounts carry no email_verified claim,
        // and Better Auth refuses untrusted, unverified links. Safe because
        // `guardAccountLink` still refuses any link unless the owner is signed
        // in (Microsoft is not in its unsigned-claim list) and refuses to
        // create a user from an unverified provider email.
        trustedProviders: ["google", "microsoft"],
        // An expert's work calendar often lives on another address than
        // their Eleva login (Outlook at the clinic, Gmail at home). Linking
        // still needs the owner signed in, and never changes the Eleva email.
        allowDifferentEmails: true,
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
      // Prefer Vercel single-value headers so multi-hop XFF does not collapse
      // every client into Better Auth's shared `no-trusted-ip` rate-limit bucket.
      ipAddress: {
        ipAddressHeaders: [...AUTH_IP_ADDRESS_HEADERS],
      },
    },
    trustedOrigins: trustedOrigins(),
    // Eleva's own numbers for every path, not Better Auth's or a plugin's
    // (./rate-limit-rules.ts says why each is what it is).
    rateLimit: {
      enabled: seam?.secondaryStorage
        ? true
        : authRateLimitEnabled(Boolean(storage)),
      storage: "secondary-storage",
      ...AUTH_RATE_LIMIT_DEFAULT,
      customRules: AUTH_RATE_LIMIT_RULES,
    },
    databaseHooks: seam
      ? undefined
      : {
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
          account: {
            create: {
              before: async (
                account: { userId: string; providerId: string },
                ctx: Parameters<typeof purgeBeforeClaim>[1]
              ) => {
                await purgeBeforeClaim(account, ctx)
              },
            },
          },
          session: {
            create: {
              // Raw-SQL personal Space provisioning skips BA createOrganization,
              // which normally sets activeOrganizationId. Without this, RSC
              // loadElevaSession can fall back to the first membership while
              // requireApiAuth rejects the same cookie with 401 no-session.
              before: async (session: {
                userId: string
                activeOrganizationId?: string | null
                impersonatedBy?: string | null
              }) => {
                refuseImpersonationSession(session)
                await refuseUnverifiedSession(session)
                if (session.activeOrganizationId) return
                const orgId = await findDefaultOrganizationId(session.userId)
                if (!orgId) return
                return { data: { activeOrganizationId: orgId } }
              },
            },
          },
        },
    user: {
      validateUserInfo: guardAccountLink,
      additionalFields: {
        timezone: {
          type: "string",
          required: false,
          // Profile writes go through audited domain APIs, not Better Auth
          // sign-up / update-user (those paths cannot wrap withAudit).
          input: false,
        },
        locale: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    disabledPaths: [
      // Leaving has no hook to guard it (a clinician with sessions still to
      // run must not vanish from a clinic); nothing in the product calls it.
      "/organization/leave",
      // A key does not expire and outlives a sign-out or a password reset,
      // and there is no screen yet to see or revoke one. Until there is,
      // no session can make itself a key: keys are issued on the server
      // (`auth.api.createApiKey`, which this list does not stop: it covers
      // HTTP only). Decision log 2026-11-22, slice 12.5.
      "/api-key/create",
    ],
    hooks: {
      // Better Auth renews a pending invitation (`resend: true`) before it
      // calls any organization hook, which would skip the clinic rules and
      // every audit row. Nothing uses that branch: invite again instead.
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/organization/invite-member" &&
          (ctx.body as { resend?: unknown } | undefined)?.resend
        ) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Sending an invitation again is not available here. Clinics use POST /teams/{teamId}/invitations.",
            code: TEAM_MEMBERS_API_REQUIRED,
          })
        }
        // A staff decision needs a session from today. Linking a sign-in
        // account, changing an API key or adding a passkey would let an old
        // staff session make itself a new way in, so staff do those on a
        // session from today too.
        //
        // Both reads go to the session store, never the 5-minute cookie
        // cache. Better Auth keeps the first answer for the rest of the
        // request, so a cached one here would also be what the endpoint
        // acts on: a session revoked a minute ago could still get in.
        if (!self.getSession) throw new APIError("INTERNAL_SERVER_ERROR")
        const readFromStore = self.getSession
        const verdict = await newCredentialVerdict({
          path: ctx.path,
          // Asked the way Better Auth reads cookies (it trims names, so
          // `session_token =…` counts), and by our own reading as well.
          hasSessionCookie:
            Boolean(ctx.getCookie(ctx.context.authCookies.sessionToken.name)) ||
            cookieHeaderHasSession(ctx.headers?.get("cookie") ?? null),
          fromCookie: () =>
            getSessionFromCtx(ctx, { disableCookieCache: true }),
          headers: ctx.headers,
          // The same store read, typed as the cookie one above.
          fromHeaders: async (headers) =>
            (await readFromStore({
              headers,
              query: { disableCookieCache: true },
            })) as Awaited<ReturnType<typeof getSessionFromCtx>>,
        })
        if (verdict === "no-session") {
          throw new APIError("UNAUTHORIZED", { message: "Sign in to do this." })
        }
        if (verdict === "sign-in-again") {
          throw new APIError("FORBIDDEN", {
            message: "Sign in again to do this.",
            code: STEP_UP_REQUIRED,
          })
        }
      }),
    },
    plugins: [
      organization({
        ac,
        roles: organizationRoles,
        allowUserToCreateOrganization: true,
        creatorRole: "owner",
        membershipLimit: TEAM_MEMBER_LIMIT,
        // Seven days, the same as a clinic invitation (`team-members.ts`).
        invitationExpiresIn: TEAM_INVITATION_TTL_MS / 1000,
        // Nobody deletes an organization through the API (ADR-026): invoices
        // are kept 10 years and session records have their own retention.
        // An expert closes a practice instead (POST /expert/closure).
        disableOrganizationDeletion: true,
        // Defence in depth: only a verified email may read or answer an
        // invitation (sessions are already refused when unverified).
        requireEmailVerificationOnInvitation: true,
        schema: {
          organization: {
            additionalFields: {
              type: {
                type: "string",
                required: true,
                defaultValue: "personal",
                input: true,
              },
              clinicSharedRecords: {
                type: "boolean",
                required: true,
                defaultValue: false,
                input: false,
              },
            },
          },
        },
        sendInvitationEmail: async (data: {
          email: string
          invitation: { id: string }
          organization: { id: string; name?: string }
          inviter?: { user?: { name?: string; locale?: string | null } }
        }) => {
          await sendOrgInvitationEmail({
            email: data.email,
            url: invitationAcceptUrl(data.invitation.id),
            orgId: data.organization.id,
            invitationId: data.invitation.id,
            organizationName: data.organization.name,
            inviterName: data.inviter?.user?.name,
            fallbackLocale: data.inviter?.user?.locale,
          })
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization, user }) => {
            const message = orgCreateViolation(organization)
            if (message) throw new APIError("FORBIDDEN", { message })
            // One expert practice per person, on every creation path.
            const practice = await secondExpertPracticeViolation(
              organization,
              user.id
            )
            if (practice) {
              throw new APIError("CONFLICT", {
                message: practice,
                code: EXPERT_PRACTICE_EXISTS,
              })
            }
          },
          beforeUpdateOrganization: async ({ organization }) => {
            const message = orgUpdateViolation(organization)
            if (message) throw new APIError("FORBIDDEN", { message })
          },
          // Nobody joins a closed practice (ADR-026): delegates removed at
          // closure cannot come back by any invitation or member path.
          // Nobody is invited through Better Auth's own endpoint. A clinic
          // invites through /teams/{teamId}/invitations, which keeps the
          // rules that protect the person invited (a decline is respected,
          // three emails a day at most, 50 addresses a day) and the audit
          // rows. No other kind of organization invites yet; when one
          // does, it gets an endpoint with the same rules.
          beforeCreateInvitation: async ({ organization }) => {
            await refuseTeamOrg(organization)
            throw new APIError("FORBIDDEN", {
              message:
                "Invitations are sent by clinics, through POST /teams/{teamId}/invitations.",
              code: TEAM_MEMBERS_API_REQUIRED,
            })
          },
          // A clinic's people change only through /teams/{teamId}/…, which
          // carries the removal guards and the audit rows.
          beforeCancelInvitation: async ({ organization }) => {
            await refuseTeamOrg(organization)
          },
          beforeRemoveMember: async ({ organization }) => {
            await refuseTeamOrg(organization)
          },
          beforeUpdateMemberRole: async ({ organization }) => {
            await refuseTeamOrg(organization)
          },
          beforeAddMember: async ({ member }) => {
            await refuseClosedPractice(member.organizationId)
          },
          beforeAcceptInvitation: async ({ invitation }) => {
            await refuseClosedPractice(invitation.organizationId)
          },
          afterAddMember: async ({
            organization,
          }: {
            organization: { id: string }
          }) => {
            enqueueTeamSeatSync(organization.id)
            // A join that raced a closure is evicted (ADR-026).
            await sweepClosedPractice(organization.id)
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
            invitation,
            member,
            user,
          }: {
            organization: { id: string }
            invitation: { id: string; role: string }
            member: { id: string }
            user: { id: string }
          }) => {
            enqueueTeamSeatSync(organization.id)
            await recordInvitationResponse({
              orgId: organization.id,
              userId: user.id,
              invitationId: invitation.id,
              role: invitation.role,
              memberId: member.id,
              outcome: "accepted",
            }).catch((err: unknown) => {
              // Not atomic with Better Auth's write: surface the gap.
              logError("[auth] invitation accept audit failed", err)
            })
            // An acceptance that raced a closure is evicted (ADR-026).
            await sweepClosedPractice(organization.id)
          },
          afterRejectInvitation: async ({
            organization,
            invitation,
            user,
          }: {
            organization: { id: string }
            invitation: { id: string; role: string }
            user: { id: string }
          }) => {
            await recordInvitationResponse({
              orgId: organization.id,
              userId: user.id,
              invitationId: invitation.id,
              role: invitation.role,
              outcome: "rejected",
            }).catch((err: unknown) => {
              // Not atomic with Better Auth's write: surface the gap.
              logError("[auth] invitation decline audit failed", err)
            })
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
          user: {
            id?: string
            email: string
            name?: string | null
            locale?: string | null
          }
          otp: string
        }) => {
          await sendTwoFactorOtpEmail({ user, otp })
        },
      }),
      passkey({
        rpID: process.env.PASSKEY_RP_ID ?? "eleva.care",
        rpName: "Eleva.care",
        origin: passkeyOrigin,
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
      apiKey(API_KEY_OPTIONS),
      openAPI({ path: "/reference", disableDefaultReference: true }),
      i18n({
        translations: {
          en: locales.en,
          es: locales.es,
          pt: locales.pt,
        },
        defaultLocale: "en",
        detection: ["cookie", "session", "header"],
        localeCookie: cookieName,
        userLocaleField: "locale",
      }),
      nextCookies(),
      ...(seam?.plugins ?? []),
    ],
    secondaryStorage: storage,
  } as never)
  self.getSession = (instance.api as unknown as AuthApi).getSession
  return instance
}

export interface AuthApi {
  getSession: (opts: {
    headers: Headers
    query?: { disableCookieCache?: boolean }
  }) => Promise<{
    session: {
      id: string
      userId: string
      token: string
      activeOrganizationId?: string | null
      /** When the person signed in for this session. */
      createdAt: Date
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
  /**
   * Typed from the plugin, not by hand: a field it renames or drops must
   * fail typecheck here. The key names its owner in `referenceId`.
   */
  verifyApiKey: (opts: { body: { key: string } }) => Promise<{
    valid: boolean
    error: { message: string; code: string } | null
    key: Omit<ApiKey, "key"> | null
  } | null>
  getAccessToken: (opts: {
    body: { accountId: string; userId?: string }
  }) => Promise<{ accessToken?: string } | null>
  generateOpenAPISchema?: () => Promise<unknown>
  signInMagicLink: (opts: {
    body: { email: string; callbackURL: string }
    headers?: Headers
  }) => Promise<unknown>
}

/**
 * Better Auth's own invite, cancel, remove and role endpoints are refused
 * for a clinic: `@eleva/auth` `team-members` owns those writes.
 */
async function refuseTeamOrg(organization: {
  id: string
  type?: unknown
}): Promise<void> {
  const type =
    typeof organization.type === "string"
      ? organization.type
      : await organizationType(organization.id)
  if (type === "team") {
    throw new APIError("FORBIDDEN", {
      message:
        "A clinic's members and invitations are managed through /teams/{teamId}/members and /teams/{teamId}/invitations.",
      code: TEAM_MEMBERS_API_REQUIRED,
    })
  }
}

async function organizationType(id: string): Promise<string | undefined> {
  const [row] = await db()
    .select({ type: authSchema.organization.type })
    .from(authSchema.organization)
    .where(eq(authSchema.organization.id, id))
    .limit(1)
  return row?.type
}

async function refuseClosedPractice(organizationId: string): Promise<void> {
  const message = await closedPracticeViolation(organizationId)
  if (message) {
    throw new APIError("FORBIDDEN", { message, code: PRACTICE_CLOSED })
  }
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
    headers: magicLinkServerHeaders(),
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
  // A browser on another origin reads only the headers named here: how
  // long to wait after a refusal for asking too often.
  headers.set("Access-Control-Expose-Headers", "Retry-After, X-Retry-After")
  headers.set("Vary", "Origin")
  return headers
}

/**
 * The limiter's refusal, said so that every caller can act on it. Better
 * Auth answers 429 with `X-Retry-After` (seconds) and an English sentence.
 * This adds the standard `Retry-After`, a code that does not change, and
 * the seconds in the body, where the sign-in screens and an agent can read
 * them without reading headers.
 */
export async function withRetryAfter(response: Response): Promise<Response> {
  const seconds = Number(response.headers.get("x-retry-after"))
  if (response.status !== 429 || !Number.isInteger(seconds) || seconds <= 0) {
    return response
  }
  const said = (await response
    .clone()
    .json()
    .catch(() => null)) as { message?: unknown } | null
  const headers = new Headers(response.headers)
  headers.set("Retry-After", String(seconds))
  headers.set("Content-Type", "application/json")
  headers.delete("Content-Length")
  return new Response(
    JSON.stringify({
      code: RATE_LIMITED_CODE,
      message:
        typeof said?.message === "string"
          ? said.message
          : "Too many requests. Please try again later.",
      retryAfter: seconds,
    }),
    { status: 429, statusText: response.statusText, headers }
  )
}

/** What every answer of `/auth/*` passes through on its way out. */
export function withCors(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }
    const response = await withRetryAfter(await handler(request))
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
