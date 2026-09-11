import { beforeEach, describe, expect, it, vi } from "vitest"
import { MEMBER_CANCEL_MIN_HOURS } from "./booking-rules"
import {
  MemberBookingPolicyError,
  cancelMemberBooking,
  rescheduleMemberBooking,
} from "./member-booking"

const getMemberBookingForPolicy = vi.fn()
const withAudit = vi.fn()
const resolveOffer = vi.fn()
const getExpertScheduleForBooking = vi.fn()
const listExpertBusyBookings = vi.fn()
const assertRequestedSlotAvailable = vi.fn()

vi.mock("@eleva/db", () => ({
  getMemberBookingForPolicy: (...args: unknown[]) =>
    getMemberBookingForPolicy(...args),
  getExpertScheduleForBooking: (...args: unknown[]) =>
    getExpertScheduleForBooking(...args),
  listExpertBusyBookings: (...args: unknown[]) =>
    listExpertBusyBookings(...args),
  main: {
    bookings: { id: "bookings.id", status: "bookings.status" },
    bookingPayments: { id: "payments.id" },
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

const now = new Date("2026-09-11T10:00:00.000Z")

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
    expertProfileId: "expert-profile-1",
    reservationId: "res-1",
    eventTypeModeId: "mode-1",
    ...overrides,
  }
}

describe("MEMBER_CANCEL_MIN_HOURS", () => {
  it("is 24 hours", () => {
    expect(MEMBER_CANCEL_MIN_HOURS).toBe(24)
  })
})

describe("cancelMemberBooking", () => {
  beforeEach(() => {
    getMemberBookingForPolicy.mockReset()
    withAudit.mockReset()
    withAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (tx: unknown, ctx: { emit: () => Promise<void> }) => unknown
      ) =>
        fn(
          {
            update: () => ({
              set: () => ({
                where: () => ({
                  returning: async () => [{ id: "booking-1" }],
                }),
              }),
            }),
          },
          { emit: vi.fn(async () => undefined) }
        )
    )
  })

  it("rejects inside the 24h window", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: new Date("2026-09-11T20:00:00.000Z") })
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

  it("allows cancel at the 24h boundary and marks refund_pending", async () => {
    const paymentSets: unknown[] = []
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: new Date("2026-09-12T10:00:00.000Z") })
    )
    withAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (tx: unknown, ctx: { emit: () => Promise<void> }) => unknown
      ) =>
        fn(
          {
            update: (table: { id: string }) => ({
              set: (values: unknown) => {
                if (table.id === "payments.id") paymentSets.push(values)
                return {
                  where: () => ({
                    returning: async () => [{ id: "booking-1" }],
                  }),
                }
              },
            }),
          },
          { emit: vi.fn(async () => undefined) }
        )
    )

    await cancelMemberBooking({
      userId: "user-1",
      orgId: "space-1",
      bookingId: "booking-1",
      now,
    })
    expect(paymentSets).toEqual([{ status: "refund_pending" }])
  })
})

describe("rescheduleMemberBooking", () => {
  beforeEach(() => {
    getMemberBookingForPolicy.mockReset()
    withAudit.mockReset()
  })

  it("rejects inside the 24h window", async () => {
    getMemberBookingForPolicy.mockResolvedValue(
      booking({ startsAt: new Date("2026-09-12T09:59:00.000Z") })
    )
    await expect(
      rescheduleMemberBooking({
        userId: "user-1",
        orgId: "space-1",
        bookingId: "booking-1",
        startsAt: new Date("2026-09-20T10:00:00.000Z"),
        endsAt: new Date("2026-09-13T10:50:00.000Z"),
        now,
      })
    ).rejects.toBeInstanceOf(MemberBookingPolicyError)
  })
})
