import { z } from "zod"

/**
 * Eleva v3 environment variable validator.
 *
 * Layered Zod schema: S0 seeded the multi-zone vars; S1-A adds WorkOS,
 * Neon (main + audit), Sentry, BetterStack, and Edge Config vars.
 *
 * Usage:
 *   import { env } from '@eleva/config/env';
 *   const appUrl = env().APP_URL;
 *
 * Never import `process.env` directly in app code — always go through
 * this validator so a missing/malformed var fails fast at boot.
 */

const urlOptional = z.string().url().optional().or(z.literal(""))
const stringOptional = z.string().optional().or(z.literal(""))
const postgresUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith("postgres"), {
    message: "must be a postgres:// URL",
  })

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: urlOptional,
  API_URL: urlOptional,
  DOCS_URL: urlOptional,
  APP_ASSET_PREFIX: urlOptional,
  API_ASSET_PREFIX: urlOptional,
  DOCS_ASSET_PREFIX: urlOptional,
})

// S1-A extension: identity + tenancy + observability + flags.
// Most fields are optional so that vitest + CI lint runs without full
// secrets; runtime consumers should use requireAuthEnv()/requireDbEnv()
// helpers below to assert presence at their own boot time.
const s1aSchema = z.object({
  WORKOS_API_KEY: stringOptional,
  WORKOS_CLIENT_ID: stringOptional,
  WORKOS_COOKIE_PASSWORD: stringOptional,
  WORKOS_REDIRECT_URI: urlOptional,
  WORKOS_VAULT_NAMESPACE: z.string().default("eleva-v3-main"),

  DATABASE_URL: postgresUrl.optional(),
  DATABASE_URL_UNPOOLED: postgresUrl.optional(),
  AUDIT_DATABASE_URL: postgresUrl.optional(),
  AUDIT_DATABASE_URL_UNPOOLED: postgresUrl.optional(),

  NEXT_PUBLIC_SENTRY_DSN: urlOptional,
  SENTRY_DSN: urlOptional,
  SENTRY_ORG: stringOptional,
  SENTRY_PROJECT: stringOptional,
  SENTRY_AUTH_TOKEN: stringOptional,

  BETTERSTACK_HEARTBEAT_URL: urlOptional,
  BETTERSTACK_LOGS_SOURCE_TOKEN: stringOptional,

  EDGE_CONFIG: urlOptional,
  FLAGS_SECRET: stringOptional,

  UPSTASH_REDIS_REST_URL: urlOptional,
  UPSTASH_REDIS_REST_TOKEN: stringOptional,
  QSTASH_TOKEN: stringOptional,
  QSTASH_CURRENT_SIGNING_KEY: stringOptional,
  QSTASH_NEXT_SIGNING_KEY: stringOptional,
})

export const envSchema = baseSchema.merge(s1aSchema)

export type Env = z.infer<typeof envSchema>
export type BaseEnv = Env

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const lines = parsed.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n")
    throw new Error(`Invalid environment variables:\n${lines}`)
  }
  cached = parsed.data
  return cached
}

export function resetEnvCache(): void {
  cached = null
}

/**
 * Narrow helpers that throw when specific groups of vars are missing.
 * Consumers that need WorkOS at runtime call requireAuthEnv(); db
 * consumers call requireDbEnv(); etc. Keeps shared boot graceful in
 * contexts that do not need the whole surface (eg. edge runtime reading
 * only flags).
 */
export function requireAuthEnv(): Required<
  Pick<Env, "WORKOS_API_KEY" | "WORKOS_CLIENT_ID" | "WORKOS_COOKIE_PASSWORD">
> {
  const e = env()
  const missing: string[] = []
  if (!e.WORKOS_API_KEY) missing.push("WORKOS_API_KEY")
  if (!e.WORKOS_CLIENT_ID) missing.push("WORKOS_CLIENT_ID")
  if (!e.WORKOS_COOKIE_PASSWORD) missing.push("WORKOS_COOKIE_PASSWORD")
  if (missing.length > 0) {
    throw new Error(`@eleva/auth boot: missing env vars: ${missing.join(", ")}`)
  }
  return {
    WORKOS_API_KEY: e.WORKOS_API_KEY!,
    WORKOS_CLIENT_ID: e.WORKOS_CLIENT_ID!,
    WORKOS_COOKIE_PASSWORD: e.WORKOS_COOKIE_PASSWORD!,
  }
}

export function requireDbEnv(): Required<Pick<Env, "DATABASE_URL">> {
  const e = env()
  if (!e.DATABASE_URL) {
    throw new Error("@eleva/db boot: missing DATABASE_URL")
  }
  return { DATABASE_URL: e.DATABASE_URL }
}

export function requireAuditDbEnv(): Required<Pick<Env, "AUDIT_DATABASE_URL">> {
  const e = env()
  if (!e.AUDIT_DATABASE_URL) {
    throw new Error("@eleva/db boot: missing AUDIT_DATABASE_URL")
  }
  return { AUDIT_DATABASE_URL: e.AUDIT_DATABASE_URL }
}
