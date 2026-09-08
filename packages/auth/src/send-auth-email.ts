import { Redis } from "@upstash/redis"
import { sendAuthEmail } from "@eleva/email"
import {
  e2eAuthUrlKey,
  shouldPersistE2eAuthUrl,
  type E2eAuthLinkKind,
} from "./e2e-auth-url"

export { e2eAuthUrlKey, type E2eAuthLinkKind }

async function persistE2eAuthUrl(
  kind: E2eAuthLinkKind,
  email: string,
  url: string
): Promise<void> {
  if (!shouldPersistE2eAuthUrl()) return
  const restUrl = process.env.KV_REST_API_URL
  const restToken = process.env.KV_REST_API_TOKEN
  if (!restUrl || !restToken || !url) return
  try {
    const redis = new Redis({ url: restUrl, token: restToken })
    await redis.set(e2eAuthUrlKey(kind, email), url, { ex: 300 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    console.warn(`[e2e] auth URL capture failed: ${message}`)
  }
}

export async function sendVerificationEmail(input: {
  user: { email: string; name?: string | null }
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("verify-email", input.user.email, input.url)
  await sendAuthEmail({
    kind: "verify-email",
    to: input.user.email,
    url: input.url,
    name: input.user.name ?? undefined,
  })
}

export async function sendResetPasswordEmail(input: {
  user: { email: string; name?: string | null }
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("reset-password", input.user.email, input.url)
  await sendAuthEmail({
    kind: "reset-password",
    to: input.user.email,
    url: input.url,
    name: input.user.name ?? undefined,
  })
}

export async function sendMagicLinkEmail(input: {
  email: string
  url: string
}): Promise<void> {
  await persistE2eAuthUrl("magic-link", input.email, input.url)
  await sendAuthEmail({
    kind: "magic-link",
    to: input.email,
    url: input.url,
  })
}
