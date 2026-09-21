import { withPlatformAudit } from "@eleva/audit"
import {
  completeSmsFromCallback,
  completeSmsFromCallbackInTx,
  loadDeliveryById,
  type DeliveryRow,
} from "./claim-delivery"
import { twilioSignedUrl, validateTwilioSignature } from "./send-sms"

const SUCCESS_STATUSES = new Set(["sent", "delivered"])
const FAILURE_STATUSES = new Set(["failed", "undelivered"])

export async function handleTwilioStatusWebhook(request: Request): Promise<{
  status: number
  body: { ok: boolean; error?: string }
}> {
  const signature = request.headers.get("x-twilio-signature")
  if (!signature) {
    return { status: 401, body: { ok: false, error: "missing signature" } }
  }
  const url = twilioSignedUrl(request)
  if (!url) {
    return { status: 500, body: { ok: false, error: "API_URL is required" } }
  }
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value
  }
  if (!validateTwilioSignature({ signature, url, params })) {
    return { status: 401, body: { ok: false, error: "invalid signature" } }
  }

  const deliveryId = new URL(url).searchParams.get("deliveryId")
  const messageSid = params.MessageSid
  const messageStatus = params.MessageStatus
  if (!deliveryId || !messageSid || !messageStatus) {
    return { status: 422, body: { ok: false, error: "missing fields" } }
  }

  const row = await loadDeliveryById(deliveryId)
  if (!row || row.channel !== "sms") {
    return { status: 200, body: { ok: true } }
  }
  if (row.status === "sent" || row.status === "delivered") {
    return { status: 200, body: { ok: true } }
  }

  const now = new Date()
  if (SUCCESS_STATUSES.has(messageStatus)) {
    await finalizeSmsCallback({
      row,
      deliveryId,
      messageSid,
      status: "sent",
      now,
    })
    return { status: 200, body: { ok: true } }
  }
  if (FAILURE_STATUSES.has(messageStatus)) {
    await finalizeSmsCallback({
      row,
      deliveryId,
      messageSid,
      status: "failed",
      error: params.ErrorMessage ?? messageStatus,
      now,
    })
    return { status: 200, body: { ok: true } }
  }
  return { status: 200, body: { ok: true } }
}

async function finalizeSmsCallback(input: {
  row: DeliveryRow
  deliveryId: string
  messageSid: string
  status: "sent" | "failed"
  error?: string | null
  now: Date
}): Promise<void> {
  const patch = {
    id: input.deliveryId,
    providerId: input.messageSid,
    status: input.status,
    error: input.error ?? null,
    now: input.now,
  }
  if (!input.row.orgId) {
    await completeSmsFromCallback(patch)
    return
  }
  await withPlatformAudit(
    { orgId: input.row.orgId, actorUserId: null },
    async (tx, ctx) => {
      const wrote = await completeSmsFromCallbackInTx(tx, patch)
      await ctx.emit({
        entity: "notification",
        action: input.status,
        entityId: input.deliveryId,
        payload: {
          channel: "sms",
          providerId: input.messageSid,
          applied: wrote,
        },
      })
    }
  )
}
