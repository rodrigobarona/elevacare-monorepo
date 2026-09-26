import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  MemberBookingPolicyError,
  cancelMemberBooking,
  quoteMemberCancellation,
  rescheduleMemberBooking,
} from "./member-booking"

const getMemberBookingForPolicy = vi.fn()
const withAudit = vi.fn()
const resolveOffer = vi.fn()
const getExpertScheduleForBooking = vi.fn()
const listExpertBusyBookings = vi.fn()
const assertRequestedSlotAvailable = vi.fn()
const emitBookingNotificationEvent = vi.fn()

vi.mock("@eleva/db", () => ({
  getMemberBookingForPolicy: (...args: unknown[]) =>
    getMemberBookingForPolicy(...args),
  getExpertScheduleForBooking: (...args: unknown[]) =>
    getExpertScheduleForBooking(...args),
  listExpertBusyBookings: (...args: unknown[]) =>
    listExpertBusyBookings(...args),
  main: {
    bookings: {
      id: "bookings.id",
      status: "bookings.status",
      startsAt: "bookings.starts_at",
      scheduleRevision: "bookings.schedule_revision",
    },
    bookingPayments: {
      id: "payments.id",
      status: "payments.status",
      refundedCents: "payments.refunded_cents",
    },
    slotReservations: { id: "slots.id", status: "slots.status" },
  },
  withOrgContext: vi.fn(),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: (...args: unknown[]) => withAudit(...args),
}))

vi.mock("./resolve-offer", () => ({
  resolveOffer: (...args: unknown[]) => resolveOffer(...args),
}))

vi.mock("./assert-slot-available", () => ({
  assertRequestedSlotAvailable: (...args: unknown[]) =>
    assertRequestedSlotAvailable(...args),
}))

vi.mock("./emit-domain-event", () => ({
  emitBookingNotificationEvent: (...args: unknown[]) =>
    emitBookingNotificationEvent(...args),
}))

const now = new Date("2026-09-11T10:00:00.000Z")
const HOUR = 3_600_000

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    orgId: "org-1",
    status: "confirmed",
    startsAt: new Date("2026-09-13T10:00:00.000Z"),
    endsAt: new Date("2026-09-13T10:50:00.000Z"),
    timezone: "Europe/Lisbon",
    sessionMode: "online",
    bookedLocale: "en",
    memberEmail: "ada@eleva.care",
    memberName: "Ada",
    guestEmail: null,
    guestName: null,
    expertUserId: "expert-1",
    expertEmail: "ana@eleva.care",
    expertName: "Ana",
    eventTypeName: { en: "Consult" },
    paymentId: "pay-1",
    paymentStatus: "succeeded",
    paymentAmountCents: 6000,
    paymentRefundedCents: 0,
    currency: "EUR",
    cancellationPolicy: "flexible",
    cancellationPolicyVersion: 1,
    bookedAt: new Date("2026-09-01T10:00:00.000Z"),
    rescheduleWindowHours: null,
    expertProfileId: "expert-profile-1",
    reservationId: "res-1",
    eventTypeModeId: "mode-1",
    ...overrides,
  }
}

function hoursFromNow(hours: number): Date {
  return new Date(now.getTime() + hours * HOUR)
}

type Captured = { paymentSets: unknown[]; audits: unknown[] }

function captureTx(): Captured {
  const captured: Captured = { paymentSets: [], audits: [] }
  withAudit.mockImplementation(
    async (
      _opts: unknown,
      fn: (tx: unknown, ctx: { emit: (e: unknown) => Promise<void> }) => unknown
    ) =>
      fn(
        {
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "payments.id") captured.paymentSets.push(values)
              return {
                where: () => ({
                  returning: async () => [{ id: "booking-1" }],
                }),
              }
            },
          }),
        },
        {
          emit: async (event: unknown) => {
            captured.audits.push(event)
          },
        }
      )
  )
  return captured
}

describe("cancelMemberBooking", () => {
  beforeEach(() => {
    getMemberBookingForPolicy.mockReset()
    withAudit.mockReset()
    emitBookingNotificationEvent.mockReset()
    emitBookingNotificationEvent.mockResolvedValue({
      eventId: "evt-1",
      created: true,
    })
  })

  it("rejects once the session has started", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: hoursFromNow(0) })
    )
    await expect(
      cancelMemberBooking({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        now,
      })
    ).rejects.toMatchObject({ code: "POLICY_TOO_LATE" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("flexible, 24h out: full refund due", async () => {
    const captured = captureTx()
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: hoursFromNow(24) })
    )
    const result = await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(result.refund).toMatchObject({
      refundPercent: 100,
      refundCents: 6000,
      currency: "EUR",
    })
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 6000, status: "refund_pending" },
    ])
    expect(emitBookingNotificationEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        orgId: "org-1",
        type: "booking.cancelled",
        bookingId: "booking-1",
        startsAt: hoursFromNow(24),
        occurredAt: now,
        refundCents: 6000,
      }
    )
  })

  it("moderate, 30h out: half refund due and recorded in the audit", async () => {
    const captured = captureTx()
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ cancellationPolicy: "moderate", startsAt: hoursFromNow(30) })
    )
    const result = await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(result.refund.refundCents).toBe(3000)
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 3000, status: "refund_pending" },
    ])
    expect(captured.audits).toEqual([
      expect.objectContaining({
        action: "canceled",
        payload: {
          reason: "member_cancel",
          policy: "moderate",
          policyVersion: 1,
          refundPercent: 50,
          refundCents: 3000,
          refundBasis: "policy_tier",
        },
      }),
    ])
  })

  it("strict, 1h out: no refund, payment stays succeeded", async () => {
    const captured = captureTx()
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ cancellationPolicy: "strict", startsAt: hoursFromNow(1) })
    )
    const result = await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(result.refund).toMatchObject({ refundPercent: 0, refundCents: 0 })
    expect(captured.paymentSets).toEqual([{ refundDueCents: 0 }])
  })

  it("refunds only what is still refundable after an earlier partial refund", async () => {
    const captured = captureTx()
    getMemberBookingForPolicy.mockResolvedValue(
      booking({
        cancellationPolicy: "moderate",
        startsAt: hoursFromNow(30),
        paymentRefundedCents: 1000,
      })
    )
    const result = await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(result.refund.refundCents).toBe(2500)
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 3500, status: "refund_pending" },
    ])
  })

  it("rolls back when the payment changed since it was read", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: hoursFromNow(48) })
    )
    withAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (tx: unknown, ctx: { emit: () => Promise<void> }) => unknown
      ) =>
        fn(
          {
            update: (table: { id: string }) => ({
              set: () => ({
                where: () => ({
                  returning: async () =>
                    table.id === "payments.id" ? [] : [{ id: "booking-1" }],
                }),
              }),
            }),
          },
          { emit: vi.fn(async () => undefined) }
        )
    )
    await expect(
      cancelMemberBooking({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        now,
      })
    ).rejects.toMatchObject({ code: "INVALID_STATUS" })
  })

  it("does not touch an unpaid booking's payment", async () => {
    const captured = captureTx()
    getMemberBookingForPolicy.mockResolvedValue(
      booking({
        paymentId: null,
        paymentStatus: null,
        paymentAmountCents: null,
      })
    )
    const result = await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(result.refund.refundCents).toBe(0)
    expect(captured.paymentSets).toEqual([])
  })
})

describe("quoteMemberCancellation", () => {
  beforeEach(() => getMemberBookingForPolicy.mockReset())

  it("returns the same quote cancel would apply", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ cancellationPolicy: "moderate", startsAt: hoursFromNow(30) })
    )
    const quote = await quoteMemberCancellation({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(quote).toMatchObject({
      policy: "moderate",
      refundPercent: 50,
      refundCents: 3000,
      nextChangeAt: hoursFromNow(6),
    })
  })

  it("404s when the booking is not the member's", async () => {
    getMemberBookingForPolicy.mockResolvedValue(null)
    await expect(
      quoteMemberCancellation({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        now,
      })
    ).rejects.toMatchObject({ code: "not_found" })
  })
})

describe("rescheduleMemberBooking", () => {
  beforeEach(() => {
    getMemberBookingForPolicy.mockReset()
    withAudit.mockReset()
  })

  it("rejects once cancelling would no longer refund in full", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ cancellationPolicy: "moderate", startsAt: hoursFromNow(47) })
    )
    await expect(
      rescheduleMemberBooking({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        startsAt: new Date("2026-09-20T10:00:00.000Z"),
        endsAt: new Date("2026-09-20T10:50:00.000Z"),
        now,
      })
    ).rejects.toBeInstanceOf(MemberBookingPolicyError)
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("honours the service reschedule window inside the full-refund window", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: hoursFromNow(30), rescheduleWindowHours: 36 })
    )
    await expect(
      rescheduleMemberBooking({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        startsAt: new Date("2026-09-20T10:00:00.000Z"),
        endsAt: new Date("2026-09-20T10:50:00.000Z"),
        now,
      })
    ).rejects.toMatchObject({ code: "POLICY_TOO_LATE" })
  })
})
