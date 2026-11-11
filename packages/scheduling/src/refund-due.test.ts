import { describe, expect, it, vi } from "vitest"
import { markRefundDue, releaseReservation } from "./refund-due"

vi.mock("@eleva/db", () => ({
  main: {
    bookingPayments: {
      id: "payments.id",
      status: "payments.status",
      refundedCents: "payments.refunded_cents",
    },
    slotReservations: { id: "slots.id", status: "slots.status" },
  },
}))

/** Every string inside a drizzle condition: the columns and values it compares. */
function stringsIn(condition: unknown, seen = new Set<unknown>()): string[] {
  if (typeof condition === "string") return [condition]
  if (!condition || typeof condition !== "object" || seen.has(condition)) {
    return []
  }
  seen.add(condition)
  return Object.values(condition).flatMap((value) => stringsIn(value, seen))
}

function fakeTx(matched: boolean) {
  const calls: { table: string; set: unknown; guards: string[] }[] = []
  const tx = {
    update: (table: { id: string }) => ({
      set: (set: unknown) => ({
        where: (condition: unknown) => {
          calls.push({ table: table.id, set, guards: stringsIn(condition) })
          return Object.assign(Promise.resolve(), {
            returning: async () => (matched ? [{ id: "pay-1" }] : []),
          })
        },
      }),
    }),
  }
  return { tx: tx as never, calls }
}

describe("markRefundDue", () => {
  it("asks for the refund on top of what was refunded before", async () => {
    const { tx, calls } = fakeTx(true)
    await expect(
      markRefundDue(tx, {
        paymentId: "pay-1",
        refundedCents: 2000,
        refundCents: 4000,
      })
    ).resolves.toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.set).toEqual({
      refundDueCents: 6000,
      status: "refund_pending",
    })
    // Only the payment as it was read: still succeeded, same amount refunded.
    expect(calls[0]?.guards).toEqual(
      expect.arrayContaining([
        "payments.id",
        "pay-1",
        "payments.status",
        "succeeded",
        "payments.refunded_cents",
      ])
    )
  })

  it("leaves the payment succeeded when nothing is refunded", async () => {
    const { tx, calls } = fakeTx(true)
    await markRefundDue(tx, {
      paymentId: "pay-1",
      refundedCents: 0,
      refundCents: 0,
    })
    expect(calls[0]?.set).toEqual({ refundDueCents: 0 })
  })

  it("answers false when the payment changed in the meantime", async () => {
    const { tx } = fakeTx(false)
    await expect(
      markRefundDue(tx, {
        paymentId: "pay-1",
        refundedCents: 0,
        refundCents: 6000,
      })
    ).resolves.toBe(false)
  })
})

describe("releaseReservation", () => {
  it("frees a reservation that still holds the time", async () => {
    const { tx, calls } = fakeTx(true)
    await releaseReservation(tx, "res-1")
    expect(calls).toEqual([
      expect.objectContaining({
        table: "slots.id",
        set: { status: "released" },
      }),
    ])
    expect(calls[0]?.guards).toEqual(
      expect.arrayContaining([
        "slots.id",
        "res-1",
        "slots.status",
        "active",
        "converted",
      ])
    )
  })
})
