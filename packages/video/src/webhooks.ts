import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000

const DailyWebhookEventSchema = z.object({
  type: z.enum([
    "meeting.started",
    "meeting.ended",
    "participant.joined",
    "participant.left",
    "error",
  ]),
  id: z.string().optional(),
  event_ts: z.number().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type DailyWebhookEvent = z.infer<typeof DailyWebhookEventSchema>

export function verifyDailyWebhook(input: {
  timestamp: string | null
  signature: string | null
  body: string
  secret: string
}): boolean {
  if (!input.timestamp || !input.signature || !input.secret) return false
  const timestamp = Number(input.timestamp)
  if (!Number.isFinite(timestamp)) return false
  const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
  if (Math.abs(Date.now() - timestampMs) > WEBHOOK_MAX_SKEW_MS) return false
  let secret: Buffer
  try {
    secret = Buffer.from(input.secret, "base64")
  } catch {
    return false
  }
  if (secret.length === 0) return false

  const computed = createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("base64")

  const a = Buffer.from(computed)
  const b = Buffer.from(input.signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function parseDailyWebhookEvent(body: unknown): DailyWebhookEvent {
  return DailyWebhookEventSchema.parse(body)
}
