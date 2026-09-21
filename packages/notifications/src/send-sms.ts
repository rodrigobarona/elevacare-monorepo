import { createHash } from "node:crypto"
import twilio from "twilio"

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function smsRefToken(deliveryId: string): string {
  const bytes = createHash("sha256").update(deliveryId).digest().subarray(0, 5)
  let bits = 0n
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte)
  }
  let token = ""
  for (let i = 0; i < 8; i += 1) {
    const index = Number((bits >> BigInt((7 - i) * 5)) & 0x1fn)
    token += BASE32[index]
  }
  return token
}

export function appendSmsRef(body: string, deliveryId: string): string {
  return `${body.trimEnd()}\nRef ${smsRefToken(deliveryId)}`
}

export function hashSmsBody(body: string): string {
  return createHash("sha256").update(body).digest("hex")
}

export type SendSmsInput = {
  to: string
  body: string
  deliveryId?: string
  statusCallbackUrl?: string
}

export type SendSmsResult = {
  providerId: string
}

export type ListedSms = {
  sid: string
  body: string
}

function twilioCredentials(): { sid: string; token: string } {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) {
    throw new Error(
      "[sms] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required"
    )
  }
  return { sid, token }
}

export function createTwilioClient() {
  const { sid, token } = twilioCredentials()
  return twilio(sid, token, {
    region: process.env.TWILIO_REGION?.trim() || "ie1",
    edge: process.env.TWILIO_EDGE?.trim() || "dublin",
  })
}

export function smsStatusCallbackUrl(deliveryId: string): string {
  const apiBase = (process.env.API_URL ?? "").replace(/\/+$/, "")
  if (!apiBase) {
    throw new Error("[sms] API_URL is required for Twilio StatusCallback")
  }
  return `${apiBase}/webhooks/twilio/status?deliveryId=${encodeURIComponent(deliveryId)}`
}

/**
 * Rebuild the URL Twilio signed: `API_URL` origin + path + the raw query
 * string from the incoming request. Never sort or re-encode the query —
 * Twilio signs the callback URL byte-for-byte as requested.
 */
export function twilioSignedUrl(request: Request): string | null {
  const apiBase = (process.env.API_URL ?? "").replace(/\/+$/, "")
  if (!apiBase) return null
  const raw = request.url
  const queryIndex = raw.indexOf("?")
  const pathname = new URL(raw).pathname
  const rawQuery = queryIndex >= 0 ? raw.slice(queryIndex) : ""
  return `${apiBase}${pathname}${rawQuery}`
}

export async function sendViaTwilio(
  input: SendSmsInput
): Promise<SendSmsResult> {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (!messagingServiceSid) {
    throw new Error("[sms] TWILIO_MESSAGING_SERVICE_SID is required")
  }
  const client = createTwilioClient()
  const message = await client.messages.create({
    to: input.to,
    body: input.body,
    messagingServiceSid,
    ...(input.statusCallbackUrl
      ? { statusCallback: input.statusCallbackUrl }
      : {}),
  })
  if (!message.sid) {
    throw new Error("[sms] Twilio accepted the send without a SID")
  }
  return { providerId: message.sid }
}

export async function listTwilioMessages(input: {
  to: string
  dateSentAfter: Date
}): Promise<ListedSms[]> {
  const client = createTwilioClient()
  const messages = await client.messages.list({
    to: input.to,
    dateSentAfter: input.dateSentAfter,
    limit: 50,
  })
  return messages.map((message) => ({
    sid: message.sid,
    body: message.body ?? "",
  }))
}

export function adoptTwilioMessage(
  messages: ListedSms[],
  smsBodyHash: string
): ListedSms | null {
  return (
    messages.find((message) => hashSmsBody(message.body) === smsBodyHash) ??
    null
  )
}

export function validateTwilioSignature(input: {
  signature: string
  url: string
  params: Record<string, string>
}): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!token) return false
  return twilio.validateRequest(token, input.signature, input.url, input.params)
}
