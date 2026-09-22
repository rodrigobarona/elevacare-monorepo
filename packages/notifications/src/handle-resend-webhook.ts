import { withPlatformAudit } from "@eleva/audit"
import { Resend, type WebhookEventPayload } from "resend"
import { z } from "zod"
import {
  completeEmailFromWebhook,
  completeEmailFromWebhookInTx,
  loadDeliveryById,
  loadDeliveryByProviderId,
  upsertEmailSuppression,
  upsertEmailSuppressionInTx,
  type DeliveryRow,
  type EmailSuppressionReason,
} from "./claim-delivery"

const HANDLED_TYPES = new Set([
  "email.delivered",
  "email.bounced",
  "email.complained",
])

const ResendEmailEventDataSchema = z.object({
  email_id: z.string().min(1),
  to: z.array(z.string()).optional(),
  tags: z.record(z.string(), z.string()).optional(),
})

const ResendHandledEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email.delivered"),
    data: ResendEmailEventDataSchema,
  }),
  z.object({
    type: z.literal("email.complained"),
    data: ResendEmailEventDataSchema,
  }),
  z.object({
    type: z.literal("email.bounced"),
    data: ResendEmailEventDataSchema.extend({
      bounce: z.object({
        message: z.string(),
        type: z.string(),
        subType: z.string().optional(),
      }),
    }),
  }),
])

export type ResendWebhookDeps = {
  verify?: (input: {
    payload: string
    headers: { id: string; timestamp: string; signature: string }
    webhookSecret: string
  }) => WebhookEventPayload
  loadById?: typeof loadDeliveryById
  loadByProviderId?: typeof loadDeliveryByProviderId
  complete?: typeof completeEmailFromWebhook
  completeInTx?: typeof completeEmailFromWebhookInTx
  suppress?: typeof upsertEmailSuppression
  suppressInTx?: typeof upsertEmailSuppressionInTx
  now?: () => Date
}

function verifyResendWebhook(input: {
  payload: string
  headers: { id: string; timestamp: string; signature: string }
  webhookSecret: string
}): WebhookEventPayload {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "re_webhook_verify")
  return resend.webhooks.verify({
    payload: input.payload,
    headers: input.headers,
    webhookSecret: input.webhookSecret,
  })
}

function isPermanentBounce(type: string | null | undefined): boolean {
  return (type ?? "").toLowerCase() === "permanent"
}

function recipientEmail(to: string[] | undefined): string | null {
  const first = to?.[0]?.trim()
  return first ? first.toLowerCase() : null
}

function deliveryIdFromTags(
  tags: Record<string, string> | undefined
): string | null {
  const value = tags?.deliveryId?.trim()
  return value || null
}

export async function handleResendWebhook(
  request: Request,
  deps: ResendWebhookDeps = {}
): Promise<{
  status: number
  body: {
    ok: boolean
    error?: string
    handled?: boolean
    issues?: z.ZodIssue[]
  }
}> {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return {
      status: 500,
      body: { ok: false, error: "RESEND_WEBHOOK_SECRET is required" },
    }
  }

  const id = request.headers.get("svix-id")
  const timestamp = request.headers.get("svix-timestamp")
  const signature = request.headers.get("svix-signature")
  if (!id || !timestamp || !signature) {
    return { status: 401, body: { ok: false, error: "missing signature" } }
  }

  const payload = await request.text()
  const verify = deps.verify ?? verifyResendWebhook
  let event: WebhookEventPayload
  try {
    event = verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })
  } catch {
    return { status: 401, body: { ok: false, error: "invalid signature" } }
  }

  if (!HANDLED_TYPES.has(event.type)) {
    return { status: 200, body: { ok: true, handled: false } }
  }

  const parsed = ResendHandledEventSchema.safeParse(event)
  if (!parsed.success) {
    return {
      status: 422,
      body: {
        ok: false,
        error: "validation",
        issues: parsed.error.issues,
      },
    }
  }
  const handled = parsed.data

  const emailId = handled.data.email_id
  const tags = handled.data.tags
  const to = handled.data.to
  const loadById = deps.loadById ?? loadDeliveryById
  const loadByProviderId = deps.loadByProviderId ?? loadDeliveryByProviderId

  const taggedId = deliveryIdFromTags(tags)
  let row: DeliveryRow | null = taggedId ? await loadById(taggedId) : null
  // A delayed webhook for an older Resend submission must not overwrite a
  // newer provider_id on the same delivery row.
  if (row?.providerId && row.providerId !== emailId) {
    row = await loadByProviderId(emailId)
  } else if (!row) {
    row = await loadByProviderId(emailId)
  }
  if (!row || row.channel !== "email") {
    return { status: 200, body: { ok: true, handled: false } }
  }

  const now = deps.now?.() ?? new Date()
  const status =
    handled.type === "email.delivered"
      ? ("delivered" as const)
      : handled.type === "email.bounced"
        ? ("bounced" as const)
        : ("complained" as const)

  const bounceMessage =
    handled.type === "email.bounced" ? handled.data.bounce.message : null
  const bounceType =
    handled.type === "email.bounced" ? handled.data.bounce.type : null

  let suppressReason: EmailSuppressionReason | null = null
  if (handled.type === "email.complained") {
    suppressReason = "complaint"
  } else if (
    handled.type === "email.bounced" &&
    isPermanentBounce(bounceType)
  ) {
    suppressReason = "hard_bounce"
  }

  const email = recipientEmail(to) ?? row.recipientEmail
  const patch = {
    id: row.id,
    providerId: emailId,
    status,
    error: bounceMessage,
    now,
  }

  await applyResendOutcome({
    row,
    patch,
    suppressReason,
    email,
    deps,
  })

  return { status: 200, body: { ok: true, handled: true } }
}

async function applyResendOutcome(input: {
  row: DeliveryRow
  patch: {
    id: string
    providerId: string
    status: "delivered" | "bounced" | "complained"
    error: string | null
    now: Date
  }
  suppressReason: EmailSuppressionReason | null
  email: string | null
  deps: ResendWebhookDeps
}): Promise<void> {
  const complete = input.deps.complete ?? completeEmailFromWebhook
  const completeInTx = input.deps.completeInTx ?? completeEmailFromWebhookInTx
  const suppress = input.deps.suppress ?? upsertEmailSuppression
  const suppressInTx = input.deps.suppressInTx ?? upsertEmailSuppressionInTx

  if (!input.row.orgId) {
    // User-scoped auth / guest e-mail rows have org_id NULL by schema.
    // withPlatformAudit requires orgId — same pattern as Twilio StatusCallback.
    await complete(input.patch)
    if (input.suppressReason && input.email) {
      await suppress({ email: input.email, reason: input.suppressReason })
    }
    return
  }

  await withPlatformAudit(
    { orgId: input.row.orgId, actorUserId: null },
    async (tx, ctx) => {
      const wrote = await completeInTx(tx, input.patch)
      let suppressionCreated = false
      if (input.suppressReason && input.email) {
        const result = await suppressInTx(tx, {
          email: input.email,
          reason: input.suppressReason,
        })
        suppressionCreated = result.created
      }
      const action =
        input.suppressReason !== null
          ? ("suppressed" as const)
          : input.patch.status === "delivered"
            ? ("sent" as const)
            : ("failed" as const)
      await ctx.emit({
        entity: "notification",
        action,
        entityId: input.patch.id,
        payload: {
          channel: "email",
          providerId: input.patch.providerId,
          status: input.patch.status,
          applied: wrote,
          suppression: input.suppressReason,
          suppressionCreated,
        },
      })
    }
  )
}
