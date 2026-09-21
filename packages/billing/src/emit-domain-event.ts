import { eq } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"

export const PAYMENT_PAYOUT_NOTIFICATION_EVENT_TYPES = [
  "payment.receipt",
  "payout.paid",
  "payout.approval_required",
] as const

export type PaymentPayoutNotificationEventType =
  (typeof PAYMENT_PAYOUT_NOTIFICATION_EVENT_TYPES)[number]

export const SEND_NOTIFICATION_SUBSCRIBER = "send-notification" as const

export type PaymentPayoutNotificationPayload = {
  paymentId?: string
  bookingId?: string
  payoutStateId?: string
  amountCents: number
  currency: string
}

export function paymentPayoutIdempotencyKey(
  type: PaymentPayoutNotificationEventType,
  entityId: string
): string {
  switch (type) {
    case "payment.receipt":
      return `payment:${entityId}:receipt`
    case "payout.paid":
      return `payout:${entityId}:paid`
    case "payout.approval_required":
      return `payout:${entityId}:approval_required`
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

export type EmitPaymentPayoutNotificationInput =
  | {
      orgId: string
      type: "payment.receipt"
      paymentId: string
      bookingId: string
      amountCents: number
      currency: string
    }
  | {
      orgId: string
      type: "payout.paid" | "payout.approval_required"
      payoutStateId: string
      amountCents: number
      currency: string
    }

/**
 * Billing cannot import `@eleva/workflows` (workflows -> billing).
 * Mirror `emitDomainEvent` for payment/payout notification kinds.
 */
export async function emitPaymentPayoutNotificationEvent(
  tx: Tx,
  input: EmitPaymentPayoutNotificationInput
): Promise<{ eventId: string; created: boolean }> {
  const entityId =
    input.type === "payment.receipt" ? input.paymentId : input.payoutStateId
  const idempotencyKey = paymentPayoutIdempotencyKey(input.type, entityId)
  const payload: PaymentPayoutNotificationPayload = {
    amountCents: input.amountCents,
    currency: input.currency,
    ...(input.type === "payment.receipt"
      ? { paymentId: input.paymentId, bookingId: input.bookingId }
      : { payoutStateId: input.payoutStateId }),
  }

  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: input.type,
      payload,
      idempotencyKey,
    })
    .onConflictDoNothing({
      target: main.domainEventsOutbox.idempotencyKey,
    })
    .returning({ id: main.domainEventsOutbox.id })

  let eventId = inserted[0]?.id
  const created = Boolean(eventId)
  if (!eventId) {
    const [existing] = await tx
      .select({ id: main.domainEventsOutbox.id })
      .from(main.domainEventsOutbox)
      .where(eq(main.domainEventsOutbox.idempotencyKey, idempotencyKey))
      .limit(1)
    if (!existing) {
      throw new Error(
        "emitPaymentPayoutNotificationEvent: conflict without existing row"
      )
    }
    eventId = existing.id
  }

  await tx
    .insert(main.domainEventDeliveries)
    .values({
      orgId: input.orgId,
      eventId,
      subscriberId: SEND_NOTIFICATION_SUBSCRIBER,
      status: "pending",
    })
    .onConflictDoNothing()

  return { eventId, created }
}
