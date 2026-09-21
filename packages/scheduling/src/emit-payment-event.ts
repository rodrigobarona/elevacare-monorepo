import { eq } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"

export const PAYMENT_FAILED_EVENT_TYPE = "payment.failed" as const

export const SEND_NOTIFICATION_SUBSCRIBER = "send-notification" as const

export type PaymentFailedPayload = {
  paymentId: string
  bookingId: string
  amountCents: number
  currency: string
}

export function paymentFailedIdempotencyKey(paymentId: string): string {
  return `payment:${paymentId}:failed`
}

/**
 * Scheduling cannot import `@eleva/workflows` (workflows -> billing ->
 * scheduling). Mirror `emitDomainEvent` for payment.failed.
 */
export async function emitPaymentFailedEvent(
  tx: Tx,
  input: {
    orgId: string
    paymentId: string
    bookingId: string
    amountCents: number
    currency: string
  }
): Promise<{ eventId: string; created: boolean }> {
  const idempotencyKey = paymentFailedIdempotencyKey(input.paymentId)
  const payload: PaymentFailedPayload = {
    paymentId: input.paymentId,
    bookingId: input.bookingId,
    amountCents: input.amountCents,
    currency: input.currency,
  }

  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: PAYMENT_FAILED_EVENT_TYPE,
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
      throw new Error("emitPaymentFailedEvent: conflict without existing row")
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
