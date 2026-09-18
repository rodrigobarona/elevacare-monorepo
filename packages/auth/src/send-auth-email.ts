import { Redis } from "@upstash/redis"
import { getAuthTransactionalMailer } from "./auth-mailer"
import {
  e2eAuthUrlKey,
  shouldPersistE2eAuthUrl,
  type E2eAuthLinkKind,
} from "./e2e-auth-url"

export { e2eAuthUrlKey, type E2eAuthLinkKind }
export {
  setAuthTransactionalMailer,
  type AuthTransactionalMailer,
} from "./auth-mailer"

async function persistE2eAuthUrl(
  kind: E2eAuthLinkKind,
  email: string,
  url: string
): Promise<void> {
  if (!shouldPersistE2eAuthUrl()) return
  const restUrl = process.env.KV_REST_API_URL
  const restToken = process.env.KV_REST_API_TOKEN
  if (!restUrl || !restToken || !url || !restUrl.startsWith("https://")) return
  try {
    const redis = new Redis({ url: restUrl, token: restToken })
    await redis.set(e2eAuthUrlKey(kind, email), url, { ex: 300 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    console.warn(`[e2e] auth URL capture failed: ${message}`)
  }
}

export async function sendVerificationEmail(input: {
  user: { id?: string; email: string; name?: string | null }
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("verify-email", input.user.email, input.url)
  await getAuthTransactionalMailer().sendVerifyEmail(input)
}

export async function sendResetPasswordEmail(input: {
  user: { id?: string; email: string; name?: string | null }
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("reset-password", input.user.email, input.url)
  await getAuthTransactionalMailer().sendResetPassword(input)
}

export async function sendMagicLinkEmail(input: {
  email: string
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("magic-link", input.email, input.url)
  await getAuthTransactionalMailer().sendMagicLink(input)
}

export async function sendTwoFactorOtpEmail(input: {
  user: { id?: string; email: string; name?: string | null }
  otp: string
}): Promise<void> {
  await getAuthTransactionalMailer().sendTwoFactorOtp(input)
}

export async function sendOrgInvitationEmail(input: {
  email: string
  url: string
  orgId: string
  invitationId: string
}): Promise<void> {
  await getAuthTransactionalMailer().sendOrgInvitation(input)
}
