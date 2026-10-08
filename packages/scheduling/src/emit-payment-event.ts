import { eq } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"
import { ENSURE_SESSION_ROOM_SUBSCRIBER } from "./emit-domain-event"

export const PAYMENT_FAILED_EVENT_TYPE = "payment.failed" as const
export const REFUND_SUCCEEDED_EVENT_TYPE = "refund.succeeded" as const

export const SEND_NOTIFICATION_SUBSCRIBER = "send-notification" as const

export type PaymentFailedPayload = {
  paymentId: string
  bookingId: string
  amountCents: number
  currency: string
  occurredAt: string
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
    occurredAt: new Date().toISOString(),
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
    .values(
      [SEND_NOTIFICATION_SUBSCRIBER, ENSURE_SESSION_ROOM_SUBSCRIBER].map(
        (subscriberId) => ({
          orgId: input.orgId,
          eventId,
          subscriberId,
          status: "pending" as const,
        })
      )
    )
    .onConflictDoNothing()

  return { eventId, created }
}

export type RefundSucceededPayload = {
  refundId: string
  bookingId: string
  paymentId: string
  amountCents: number
  occurredAt: string
  /** Full refund of the payment. Partial refunds do not cancel the session. */
  cancelsSession: boolean
}

export function refundSucceededIdempotencyKey(refundId: string): string {
  return `refund:${refundId}:succeeded`
}

export async function emitRefundSucceededEvent(
  tx: Tx,
  input: {
    orgId: string
    refundId: string
    bookingId: string
    paymentId: string
    amountCents: number
    cancelsSession: boolean
  }
): Promise<{ eventId: string; created: boolean }> {
  const idempotencyKey = refundSucceededIdempotencyKey(input.refundId)
  const payload: RefundSucceededPayload = {
    refundId: input.refundId,
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    amountCents: input.amountCents,
    occurredAt: new Date().toISOString(),
    cancelsSession: input.cancelsSession,
  }

  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: REFUND_SUCCEEDED_EVENT_TYPE,
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
      throw new Error("emitRefundSucceededEvent: conflict without existing row")
    }
    eventId = existing.id
  }

  await tx
    .insert(main.domainEventDeliveries)
    .values({
      orgId: input.orgId,
      eventId,
      subscriberId: ENSURE_SESSION_ROOM_SUBSCRIBER,
      status: "pending",
    })
    .onConflictDoNothing()

  return { eventId, created }
}
