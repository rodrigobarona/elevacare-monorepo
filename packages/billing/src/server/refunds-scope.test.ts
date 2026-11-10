import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Clinic clinicians (`isClinicClinician`) refund only bookings where they
 * are the expert. The scope check runs before any amount, Stripe or write
 * step, so an over-large amount surfacing as AMOUNT_INVALID proves the
 * caller got past it.
 */

const ORG_ID = "22222222-2222-4222-8222-222222222222"
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333"
const BOOKING_ID = "44444444-4444-4444-8444-444444444444"
const OWN_PROFILE_ID = "55555555-5555-4555-8555-555555555555"
const COLLEAGUE_PROFILE_ID = "66666666-6666-4666-8666-666666666666"

const { selects } = vi.hoisted(() => ({
  selects: { queue: [] as unknown[][], calls: 0 },
}))

vi.mock("./client", () => ({ stripe: vi.fn() }))
vi.mock("@eleva/observability", () => ({ captureException: vi.fn() }))
vi.mock("@eleva/accounting", () => ({
  issuePlatformFeeCreditNote: vi.fn(),
  shouldIssuePlatformFeeCreditNote: () => false,
}))
vi.mock("@eleva/audit", () => ({
  withAudit: vi.fn(),
  withPlatformAudit: vi.fn(),
}))
vi.mock("@eleva/scheduling", () => ({ emitRefundSucceededEvent: vi.fn() }))
vi.mock("./payouts", () => ({ applyHold: vi.fn(), clearHold: vi.fn() }))

vi.mock("@eleva/db", () => {
  const tx = {
    select: () => tx,
    from: () => tx,
    where: () => tx,
    orderBy: () => tx,
    limit: async () => {
      selects.calls += 1
      return selects.queue.shift() ?? []
    },
  }
  return {
    main: {
      bookingPayments: { id: "booking_payments.id" },
      bookings: {
        id: "bookings.id",
        expertProfileId: "bookings.expert_profile_id",
      },
      bookingRefunds: {
        bookingPaymentId: "booking_refunds.booking_payment_id",
        refundSeq: "booking_refunds.refund_seq",
      },
      payoutStates: { bookingPaymentId: "payout_states.booking_payment_id" },
    },
    withPlatformAdminContext: (fn: (handle: typeof tx) => unknown) => fn(tx),
    withOrgContext: (_org: string, fn: (handle: typeof tx) => unknown) =>
      fn(tx),
  }
})

const { refundBookingPayment } = await import("./refunds")

const payment = {
  id: PAYMENT_ID,
  orgId: ORG_ID,
  bookingId: BOOKING_ID,
  amountCents: 6000,
  refundedCents: 0,
}

const tooMuch = {
  bookingPaymentId: PAYMENT_ID,
  amountCents: 999_999,
  reason: "requested_by_customer",
  actorUserId: "77777777-7777-4777-8777-777777777777",
  actingOrgId: ORG_ID,
}

describe("refundBookingPayment clinician scope", () => {
  beforeEach(() => {
    selects.queue = []
    selects.calls = 0
  })

  it("refuses a clinician refunding a colleague's booking", async () => {
    selects.queue = [[payment], [{ expertProfileId: COLLEAGUE_PROFILE_ID }]]
    await expect(
      refundBookingPayment({
        ...tooMuch,
        actingExpertProfileId: OWN_PROFILE_ID,
      })
    ).rejects.toMatchObject({ code: "EXPERT_MISMATCH", status: 403 })
  })

  it("refuses when the booking cannot be found", async () => {
    selects.queue = [[payment], []]
    await expect(
      refundBookingPayment({
        ...tooMuch,
        actingExpertProfileId: OWN_PROFILE_ID,
      })
    ).rejects.toMatchObject({ code: "EXPERT_MISMATCH" })
  })

  it("lets a clinician through on their own booking", async () => {
    selects.queue = [[payment], [{ expertProfileId: OWN_PROFILE_ID }]]
    await expect(
      refundBookingPayment({
        ...tooMuch,
        actingExpertProfileId: OWN_PROFILE_ID,
      })
    ).rejects.toMatchObject({ code: "AMOUNT_INVALID" })
  })

  it("keeps org-wide refunds for experts and clinic admins", async () => {
    selects.queue = [[payment]]
    await expect(refundBookingPayment(tooMuch)).rejects.toMatchObject({
      code: "AMOUNT_INVALID",
    })
    // Only the payment was read: no booking lookup without a clinician scope.
    expect(selects.calls).toBe(1)
  })

  it("still refuses another org's payment first", async () => {
    selects.queue = [[{ ...payment, orgId: "other-org" }]]
    await expect(
      refundBookingPayment({
        ...tooMuch,
        actingExpertProfileId: OWN_PROFILE_ID,
      })
    ).rejects.toMatchObject({ code: "ORG_MISMATCH" })
  })
})
