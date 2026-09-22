import { withPlatformAudit } from "@eleva/audit"
import { Resend } from "resend"
import { z } from "zod"
import {
  MarketingAutomationEventSchema,
  MarketingCallerPayloadSchema,
  MarketingPayloadSchema,
  type MarketingAutomationEvent,
  type MarketingPayload,
} from "./marketing-payload"
import {
  syncMarketingContact,
  type SyncMarketingContactDeps,
  type SyncMarketingContactResult,
} from "./sync-marketing-contact"

export class MarketingConsentRequiredError extends Error {
  readonly code = "MARKETING_CONSENT_REQUIRED"

  constructor() {
    super("marketing consent is required before triggering Lane 2 automations")
    this.name = "MarketingConsentRequiredError"
  }
}

export class TriggerAutomationError extends Error {
  readonly code = "TRIGGER_AUTOMATION_FAILED"

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "TriggerAutomationError"
  }
}

export type TriggerAutomationInput = {
  event: MarketingAutomationEvent
  userId: string
  orgId?: string
  /**
   * Optional caller fields only (`plan_tier`, `generic_booking_count`).
   * `first_name` / `locale` are derived from the synced user row.
   */
  marketingPayload?: unknown
}

export type TriggerAutomationResult = {
  event: MarketingAutomationEvent
  email: string
  contactId: string | null
  payload: MarketingPayload
}

export type TriggerAutomationDeps = SyncMarketingContactDeps & {
  sync?: (
    input: { userId: string; orgId?: string },
    deps?: SyncMarketingContactDeps
  ) => Promise<SyncMarketingContactResult>
  sendEvent?: (input: {
    event: MarketingAutomationEvent
    email: string
    payload: MarketingPayload
  }) => Promise<void>
  auditTrigger?: typeof auditAutomationTrigger
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new TriggerAutomationError("RESEND_API_KEY is not configured")
  }
  return new Resend(apiKey)
}

async function sendResendAutomationEvent(input: {
  event: MarketingAutomationEvent
  email: string
  payload: MarketingPayload
}): Promise<void> {
  const resend = getResend()
  const { error } = await resend.events.send({
    event: input.event,
    email: input.email,
    payload: input.payload,
  })
  if (error) {
    throw new TriggerAutomationError(
      `resend events.send failed: ${error.name ?? "Error"}: ${error.message}`,
      { cause: error }
    )
  }
}

async function auditAutomationTrigger(input: {
  orgId: string
  actorUserId: string
  entityId: string | null
  payload: Record<string, unknown>
}): Promise<void> {
  await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "marketing_contact",
        action: "sent",
        entityId: input.entityId,
        payload: input.payload,
      })
    }
  )
}

/**
 * Lane 2 entrypoint (stub). Ensures the Resend contact is synced under
 * marketing consent, builds a PHI-free payload from the Neon user row
 * (+ optional closed plan_tier / booking count), then fires
 * `resend.events.send`. Automations themselves are dashboard-seeded.
 */
export async function triggerAutomation(
  input: TriggerAutomationInput,
  deps: TriggerAutomationDeps = {}
): Promise<TriggerAutomationResult> {
  const event = MarketingAutomationEventSchema.parse(input.event)
  let callerPayload: z.infer<typeof MarketingCallerPayloadSchema>
  try {
    callerPayload = MarketingCallerPayloadSchema.parse(
      input.marketingPayload ?? {}
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new TriggerAutomationError(
        `marketing payload rejected: ${error.issues.map((i) => i.path.join(".") || "(root)").join(", ")}`,
        { cause: error }
      )
    }
    throw error
  }

  const sync = deps.sync ?? syncMarketingContact
  const sendEvent = deps.sendEvent ?? sendResendAutomationEvent
  const auditTrigger = deps.auditTrigger ?? auditAutomationTrigger

  const synced = await sync({ userId: input.userId, orgId: input.orgId }, deps)
  if (synced.action !== "upserted") {
    throw new MarketingConsentRequiredError()
  }

  const firstName = synced.firstName?.trim()
  if (!firstName) {
    throw new TriggerAutomationError(
      "marketing automation requires a first name on the user profile"
    )
  }

  const payload = MarketingPayloadSchema.parse({
    ...callerPayload,
    first_name: firstName,
    locale: synced.locale,
  })

  await sendEvent({
    event,
    email: synced.email,
    payload,
  })

  const orgId = input.orgId ?? synced.orgId
  if (orgId) {
    try {
      await auditTrigger({
        orgId,
        actorUserId: input.userId,
        entityId: synced.contactId,
        payload: {
          userId: input.userId,
          event,
          locale: payload.locale,
        },
      })
    } catch (err) {
      // Provider already accepted the event — do not reject (and invite a
      // duplicate send on retry). Durable outbox lands with domain fan-out.
      console.error(
        "[triggerAutomation] audit failed after resend.events.send",
        err
      )
    }
  }

  return {
    event,
    email: synced.email,
    contactId: synced.contactId,
    payload,
  }
}
