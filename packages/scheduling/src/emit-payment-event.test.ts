import { describe, expect, it } from "vitest"
import {
  PAYMENT_FAILED_EVENT_TYPE,
  emitPaymentFailedEvent,
  paymentFailedIdempotencyKey,
} from "./emit-payment-event"

describe("payment.failed events", () => {
  it("uses a payment-scoped idempotency key", () => {
    expect(PAYMENT_FAILED_EVENT_TYPE).toBe("payment.failed")
    expect(
      paymentFailedIdempotencyKey("00000000-0000-4000-8000-000000000010")
    ).toBe("payment:00000000-0000-4000-8000-000000000010:failed")
  })

  it("inserts a send-notification delivery", async () => {
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
    await emitPaymentFailedEvent(tx as never, {
      orgId: "00000000-0000-4000-8000-000000000001",
      paymentId: "00000000-0000-4000-8000-000000000010",
      bookingId: "00000000-0000-4000-8000-000000000011",
      amountCents: 6000,
      currency: "EUR",
    })
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        type: "payment.failed",
        idempotencyKey: "payment:00000000-0000-4000-8000-000000000010:failed",
      })
    )
  })
})
