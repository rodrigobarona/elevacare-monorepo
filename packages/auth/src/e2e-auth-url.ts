import { createHash } from "node:crypto"

export type E2eAuthLinkKind = "verify-email" | "reset-password" | "magic-link"

export function e2eAuthUrlKey(kind: E2eAuthLinkKind, email: string): string {
  const digest = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
  return `e2e:auth-url:${kind}:${digest}`
}

type RuntimeEnv = {
  VERCEL_ENV?: string
  NODE_ENV?: string
  E2E_AUTH_CAPTURE?: string
}

export function shouldPersistE2eAuthUrl(
  env: RuntimeEnv = process.env
): boolean {
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return false
  }
  return env.E2E_AUTH_CAPTURE === "1"
}

export function authRateLimitEnabled(
  hasSecondaryStorage: boolean,
  env: RuntimeEnv = process.env
): boolean {
  if (!hasSecondaryStorage) return false
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    return true
  }
  if (env.NODE_ENV === "production" && !env.VERCEL_ENV) return true
  return false
}
