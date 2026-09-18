/**
 * Closed-gate invoice domain events (Phase 08.1).
 *
 * `issueInvoice()` is still closed, so these fire when a
 * `platform_fee_invoices` row becomes `blocked` / `skipped` / `pending`
 * — never `issued` / `failed`. Accounting cannot import `@eleva/workflows`
 * (that package already depends on this one), so the outbox insert lives
 * here and mirrors `emitDomainEvent`.
 */

import { eq } from "drizzle-orm"
import { main, type Tx } from "@eleva/db"

export const CLOSED_GATE_INVOICE_EVENT_TYPES = [
  "invoice.blocked",
  "invoice.skipped",
  "invoice.pending",
] as const

export type ClosedGateInvoiceEventType =
  (typeof CLOSED_GATE_INVOICE_EVENT_TYPES)[number]

export const CLOSED_GATE_INVOICE_STATUSES = [
  "blocked",
  "skipped",
  "pending",
] as const

export type ClosedGateInvoiceStatus =
  (typeof CLOSED_GATE_INVOICE_STATUSES)[number]

export const CLOSED_GATE_INVOICE_SUBSCRIBERS = ["logger"] as const

export type ClosedGateInvoicePayload = {
  invoiceKind: "platform_fee"
  invoiceId: string
  bookingPaymentId: string
  expertOrgId: string
  status: ClosedGateInvoiceStatus
  number: null
  pdfUrl: null
  error: string | null
}

export type ClosedGateInvoiceEventRef = {
  type: ClosedGateInvoiceEventType
  idempotencyKey: string
}

export function closedGateInvoiceEventType(
  status: ClosedGateInvoiceStatus
): ClosedGateInvoiceEventType {
  switch (status) {
    case "blocked":
      return "invoice.blocked"
    case "skipped":
      return "invoice.skipped"
    case "pending":
      return "invoice.pending"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function closedGateInvoiceIdempotencyKey(
  invoiceId: string,
  status: ClosedGateInvoiceStatus
): string {
  return `invoice:platform_fee:${invoiceId}:${status}`
}

export function closedGateInvoicePayload(input: {
  invoiceId: string
  bookingPaymentId: string
  expertOrgId: string
  status: ClosedGateInvoiceStatus
  error: string | null
}): ClosedGateInvoicePayload {
  return {
    invoiceKind: "platform_fee",
    invoiceId: input.invoiceId,
    bookingPaymentId: input.bookingPaymentId,
    expertOrgId: input.expertOrgId,
    status: input.status,
    number: null,
    pdfUrl: null,
    error: input.error,
  }
}

export async function emitClosedGateInvoiceDomainEvent(
  tx: Tx,
  input: {
    orgId: string
    invoiceId: string
    bookingPaymentId: string
    expertOrgId: string
    status: ClosedGateInvoiceStatus
    error: string | null
  }
): Promise<ClosedGateInvoiceEventRef> {
  const type = closedGateInvoiceEventType(input.status)
  const idempotencyKey = closedGateInvoiceIdempotencyKey(
    input.invoiceId,
    input.status
  )
  const payload = closedGateInvoicePayload(input)

  const inserted = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type,
      payload,
      idempotencyKey,
    })
    .onConflictDoNothing({
      target: main.domainEventsOutbox.idempotencyKey,
    })
    .returning({ id: main.domainEventsOutbox.id })

  let eventId = inserted[0]?.id
  if (!eventId) {
    const [existing] = await tx
      .select({ id: main.domainEventsOutbox.id })
      .from(main.domainEventsOutbox)
      .where(eq(main.domainEventsOutbox.idempotencyKey, idempotencyKey))
      .limit(1)
    if (!existing) {
      throw new Error(
        "emitClosedGateInvoiceDomainEvent: conflict without existing row"
      )
    }
    eventId = existing.id
  }

  for (const subscriberId of CLOSED_GATE_INVOICE_SUBSCRIBERS) {
    await tx
      .insert(main.domainEventDeliveries)
      .values({
        orgId: input.orgId,
        eventId,
        subscriberId,
        status: "pending",
      })
      .onConflictDoNothing()
  }

  return { type, idempotencyKey }
}
