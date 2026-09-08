import { apiKey } from "@better-auth/api-key"
import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access"
import {
  admin,
  bearer,
  jwt,
  magicLink,
  openAPI,
  organization,
  twoFactor,
} from "better-auth/plugins"
import { Pool } from "pg"
import { emitSpikeAudit } from "./audit.ts"
import { captureEmail } from "./inbox.ts"

const databaseUrl = process.env.SPIKE_DATABASE_URL
if (!databaseUrl) {
  throw new Error("SPIKE_DATABASE_URL is required")
}

const secret = process.env.BETTER_AUTH_SECRET
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is required")
}

const baseURL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8787"
const cookieDomain = process.env.ELEVA_COOKIE_DOMAIN ?? ".dev.eleva.care"

export const pool = new Pool({ connectionString: databaseUrl })

export const auth = betterAuth({
  appName: "Eleva.care spike",
  baseURL,
  basePath: "/auth",
  secret,
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      captureEmail({ kind: "reset", to: user.email, url, token })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      captureEmail({ kind: "verify", to: user.email, url, token })
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "spike-google-client-id",
      clientSecret:
        process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "spike-google-client-secret",
      accessType: "offline",
      prompt: "consent",
    },
  },
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
    crossSubDomainCookies: { enabled: true, domain: cookieDomain },
    useSecureCookies: false,
    database: { generateId: "uuid" },
  },
  trustedOrigins: [
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "https://dev.eleva.care",
    "https://api.dev.eleva.care",
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const firstName = (user.name ?? "Member").split(/\s+/)[0] ?? "Member"
          try {
            const created = await auth.api.createOrganization({
              body: {
                name: `${firstName}'s Space`,
                slug: `space-${user.id.replaceAll("-", "").slice(0, 12)}`,
                userId: user.id,
                type: "personal",
              },
            })
            // 02.1 replaces this stand-in with withAudit() from @eleva/audit.
            emitSpikeAudit({
              entity: "organization",
              action: "created",
              entityId: created.id,
              payload: { type: "personal", name: created.name },
            })
          } catch (error) {
            console.error("provision personal Space failed", error)
            throw error
          }
        },
      },
    },
  },
  plugins: [
    organization({
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
    }),
    admin({
      ac: defaultAc,
      roles: {
        user: userAc,
        platform_admin: adminAc,
      },
      defaultRole: "user",
      adminRoles: ["platform_admin"],
    }),
    twoFactor({ issuer: "Eleva.care" }),
    passkey({
      rpID: "localhost",
      rpName: "Eleva.care",
      origin: baseURL,
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        captureEmail({ kind: "magic-link", to: email, url, token })
      },
    }),
    bearer(),
    jwt(),
    apiKey({ enableMetadata: true }),
    openAPI({ path: "/reference", disableDefaultReference: true }),
  ],
})

export const BETTER_AUTH_VERSION = "1.7.3"
