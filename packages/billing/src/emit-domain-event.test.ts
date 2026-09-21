import { describe, expect, it } from "vitest"
import {
  PAYMENT_PAYOUT_NOTIFICATION_EVENT_TYPES,
  emitPaymentPayoutNotificationEvent,
  paymentPayoutIdempotencyKey,
} from "./emit-domain-event"

describe("payment/payout notification events", () => {
  it("covers receipt and payout kinds without issued invoices", () => {
    expect(PAYMENT_PAYOUT_NOTIFICATION_EVENT_TYPES).toEqual([
      "payment.receipt",
      "payout.paid",
      "payout.approval_required",
    ])
    expect(PAYMENT_PAYOUT_NOTIFICATION_EVENT_TYPES).not.toContain(
      "invoice.issued"
    )
  })

  it("keeps payout.paid and payout.approval_required on distinct keys", () => {
    const id = "00000000-0000-4000-8000-000000000002"
    expect(paymentPayoutIdempotencyKey("payout.paid", id)).not.toBe(
      paymentPayoutIdempotencyKey("payout.approval_required", id)
    )
  })

  it("inserts a send-notification delivery for payment.receipt", async () => {
    const inserts: unknown[] = []
    const tx = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserts.push(values)
          return {
            onConflictDoNothing: () => ({
              returning: async () =>
                typeof values.type === "string" ? [{ id: "evt-1" }] : [],
            }),
          }
        },
      }),
    }
    await emitPaymentPayoutNotificationEvent(tx as never, {
      orgId: "00000000-0000-4000-8000-000000000001",
      type: "payment.receipt",
      paymentId: "00000000-0000-4000-8000-000000000010",
      bookingId: "00000000-0000-4000-8000-000000000011",
      amountCents: 6000,
      currency: "EUR",
    })
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        type: "payment.receipt",
        idempotencyKey: "payment:00000000-0000-4000-8000-000000000010:receipt",
      })
    )
    expect(inserts[1]).toEqual(
      expect.objectContaining({
        subscriberId: "send-notification",
        eventId: "evt-1",
      })
    )
  })
})
