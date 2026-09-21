import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/email", () => ({
  renderPaymentPayoutNotice: vi.fn(async () => "<p>notice</p>"),
  getEmailTranslations: vi.fn(() => ({
    payment: {
      failedTitle: "Payment could not be completed",
      failedSubtitle: "Try again.",
      receiptTitle: "Payment received",
      receiptSubtitle: "We received it.",
    },
    payout: {
      paidTitle: "Payout sent",
      paidSubtitle: "On the way.",
      approvalTitle: "Payout needs approval",
      approvalSubtitle: "Staff review.",
    },
    subject: {
      paymentFailed: "Payment could not be completed",
      paymentReceipt: "Payment received",
      payoutPaid: "Payout sent",
      payoutApprovalRequired: "Payout needs approval",
    },
  })),
}))
vi.mock("@eleva/db", () => ({
  auth: { user: {}, member: {} },
  main: { bookings: {}, payoutStates: {} },
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("./send-notification", () => ({
  sendNotification: vi.fn(),
}))

import {
  PAYMENT_PAYOUT_NOTIFICATION_KINDS,
  sendPaymentPayoutNotification,
} from "./send-payment-payout-notification"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const PAYMENT_ID = "00000000-0000-4000-8000-000000000010"
const BOOKING_ID = "00000000-0000-4000-8000-000000000011"
const MEMBER_ID = "00000000-0000-4000-8000-000000000012"
const PAYOUT_ID = "00000000-0000-4000-8000-000000000013"
const STAFF_ID = "00000000-0000-4000-8000-000000000014"

describe("sendPaymentPayoutNotification", () => {
  it("sends payment.failed to the member with a payment-scoped key", async () => {
    const send = vi.fn().mockResolvedValue({ kind: "payment.failed" })
    await sendPaymentPayoutNotification(
      {
        id: "evt-1",
        type: "payment.failed",
        orgId: ORG_ID,
        payload: {
          paymentId: PAYMENT_ID,
          bookingId: BOOKING_ID,
          amountCents: 6000,
          currency: "EUR",
        },
      },
      {
        loadPaymentBooking: async () => ({
          orgId: ORG_ID,
          bookedLocale: "en",
          memberUserId: MEMBER_ID,
          memberName: "Ada Lovelace",
          guestEmail: null,
          guestName: null,
        }),
        send,
      }
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment.failed",
        recipient: { userId: MEMBER_ID },
        idempotencyKey: `payment:${PAYMENT_ID}:failed`,
      })
    )
  })

  it("sends payout.approval_required to staff, not the expert org", async () => {
    const send = vi.fn().mockResolvedValue({ kind: "payout.approval_required" })
    await sendPaymentPayoutNotification(
      {
        id: "evt-2",
        type: "payout.approval_required",
        orgId: ORG_ID,
        payload: {
          payoutStateId: PAYOUT_ID,
          amountCents: 5100,
          currency: "EUR",
        },
      },
      {
        loadPayoutOrg: async () => ({ orgId: ORG_ID }),
        listStaff: async () => [
          {
            userId: STAFF_ID,
            email: "ops@eleva.care",
            name: "Ops",
            locale: "en",
            role: "staff_finance",
          },
        ],
        listOperators: async () => [
          {
            userId: MEMBER_ID,
            email: "ana@eleva.care",
            name: "Ana",
            locale: "en",
            role: "owner",
          },
        ],
        send,
      }
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payout.approval_required",
        recipient: { userId: STAFF_ID },
        idempotencyKey: `payout:${PAYOUT_ID}:approval_required`,
      })
    )
  })

  it("sends payment.receipt to a guest email when there is no member account", async () => {
    const send = vi.fn().mockResolvedValue({ kind: "payment.receipt" })
    await sendPaymentPayoutNotification(
      {
        id: "evt-3",
        type: "payment.receipt",
        orgId: ORG_ID,
        payload: {
          paymentId: PAYMENT_ID,
          bookingId: BOOKING_ID,
          amountCents: 6000,
          currency: "EUR",
        },
      },
      {
        loadPaymentBooking: async () => ({
          orgId: ORG_ID,
          bookedLocale: "pt",
          memberUserId: null,
          memberName: null,
          guestEmail: "guest@example.com",
          guestName: "Ada Guest",
        }),
        send,
      }
    )
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment.receipt",
        recipient: { email: "guest@example.com", locale: "pt" },
        idempotencyKey: `payment:${PAYMENT_ID}:receipt`,
      })
    )
  })

  it("sends payout.paid to expert operators, not staff", async () => {
    const send = vi.fn().mockResolvedValue({ kind: "payout.paid" })
    await sendPaymentPayoutNotification(
      {
        id: "evt-4",
        type: "payout.paid",
        orgId: ORG_ID,
        payload: {
          payoutStateId: PAYOUT_ID,
          amountCents: 5100,
          currency: "EUR",
        },
      },
      {
        loadPayoutOrg: async () => ({ orgId: ORG_ID }),
        listStaff: async () => [
          {
            userId: STAFF_ID,
            email: "ops@eleva.care",
            name: "Ops",
            locale: "en",
            role: "staff_finance",
          },
        ],
        listOperators: async () => [
          {
            userId: MEMBER_ID,
            email: "ana@eleva.care",
            name: "Ana",
            locale: "en",
            role: "owner",
          },
        ],
        send,
      }
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payout.paid",
        recipient: { userId: MEMBER_ID },
        idempotencyKey: `payout:${PAYOUT_ID}:paid`,
      })
    )
  })

  it("does not register invoice.issued", () => {
    expect(PAYMENT_PAYOUT_NOTIFICATION_KINDS).not.toContain("invoice.issued")
    expect(PAYMENT_PAYOUT_NOTIFICATION_KINDS).not.toContain("invoice.failed")
  })
})
