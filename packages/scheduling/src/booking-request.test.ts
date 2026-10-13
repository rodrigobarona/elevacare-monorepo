import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  BookingRequestError,
  acceptBookingRequest,
  declineBookingRequest,
  expireBookingRequests,
} from "./booking-request"

const getExpertBookingForApproval = vi.fn()
const listExpiredBookingRequests = vi.fn()
const withAudit = vi.fn()
const emitGuestActivationRequired = vi.fn()
const ensureSessionRow = vi.fn()
const emitBookingNotificationEvent = vi.fn()

vi.mock("@eleva/db", () => ({
  getExpertBookingForApproval: (...args: unknown[]) =>
    getExpertBookingForApproval(...args),
  listExpiredBookingRequests: (...args: unknown[]) =>
    listExpiredBookingRequests(...args),
  main: {
    bookings: { id: "bookings.id", status: "bookings.status" },
    bookingPayments: { id: "payments.id", status: "payments.status" },
    slotReservations: { id: "slots.id", status: "slots.status" },
  },
}))

vi.mock("@eleva/audit", () => ({
  withAudit: (...args: unknown[]) => withAudit(...args),
}))

vi.mock("./confirm-booking", () => ({
  emitGuestActivationRequired: (...args: unknown[]) =>
    emitGuestActivationRequired(...args),
}))

vi.mock("./ensure-session-row", () => ({
  ensureSessionRow: (...args: unknown[]) => ensureSessionRow(...args),
}))

vi.mock("./emit-domain-event", () => ({
  emitBookingNotificationEvent: (...args: unknown[]) =>
    emitBookingNotificationEvent(...args),
}))

const now = new Date("2026-10-13T10:00:00.000Z")

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    orgId: "org-1",
    status: "awaiting_confirmation",
    startsAt: new Date("2026-10-20T10:00:00.000Z"),
    endsAt: new Date("2026-10-20T10:50:00.000Z"),
    eventTypeId: "et-1",
    expertProfileId: "ep-1",
    memberUserId: "member-1",
    sessionMode: "online",
    reservationId: "res-1",
    requiresApproval: true,
    approvalDeadlineAt: new Date("2026-10-14T10:00:00.000Z"),
    paymentId: "pay-1",
    paymentStatus: "succeeded",
    paymentAmountCents: 6000,
    paymentRefundedCents: 0,
    ...overrides,
  }
}

function captureTx() {
  const captured = {
    bookingSets: [] as unknown[],
    paymentSets: [] as unknown[],
    reservationSets: [] as unknown[],
    audits: [] as unknown[],
  }
  withAudit.mockImplementation(
    async (
      _opts: unknown,
      fn: (tx: unknown, ctx: { emit: (e: unknown) => Promise<void> }) => unknown
    ) =>
      fn(
        {
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "bookings.id") captured.bookingSets.push(values)
              if (table.id === "payments.id") captured.paymentSets.push(values)
              if (table.id === "slots.id") captured.reservationSets.push(values)
              return {
                where: () => ({
                  returning: async () => [{ id: "row-1" }],
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

describe("acceptBookingRequest", () => {
  beforeEach(() => {
    getExpertBookingForApproval.mockReset()
    withAudit.mockReset()
    emitGuestActivationRequired.mockReset()
    ensureSessionRow.mockReset()
    emitBookingNotificationEvent.mockReset()
    emitBookingNotificationEvent.mockResolvedValue({
      eventId: "evt-1",
      created: true,
    })
  })

  it("is a no-op when already confirmed", async () => {
    getExpertBookingForApproval.mockResolvedValue(row({ status: "confirmed" }))
    await expect(
      acceptBookingRequest({
        actorUserId: "expert-1",
        orgId: "org-1",
        expertProfileId: "ep-1",
        bookingId: "booking-1",
        now,
      })
    ).resolves.toEqual({ bookingId: "booking-1" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("rejects after the approval window", async () => {
    getExpertBookingForApproval.mockResolvedValue(
      row({ approvalDeadlineAt: new Date("2026-10-13T09:00:00.000Z") })
    )
    await expect(
      acceptBookingRequest({
        actorUserId: "expert-1",
        orgId: "org-1",
        expertProfileId: "ep-1",
        bookingId: "booking-1",
        now,
      })
    ).rejects.toMatchObject({ code: "REQUEST_EXPIRED" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("confirms, creates the session, and emits request_accepted", async () => {
    const captured = captureTx()
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(
      acceptBookingRequest({
        actorUserId: "expert-1",
        orgId: "org-1",
        expertProfileId: "ep-1",
        bookingId: "booking-1",
        now,
      })
    ).resolves.toEqual({ bookingId: "booking-1" })
    expect(captured.bookingSets).toEqual([
      expect.objectContaining({
        status: "confirmed",
        confirmedAt: now,
      }),
    ])
    expect(emitGuestActivationRequired).toHaveBeenCalled()
    expect(ensureSessionRow).toHaveBeenCalled()
    expect(emitBookingNotificationEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "booking.request_accepted" })
    )
    expect(captured.audits).toEqual([
      expect.objectContaining({ entity: "booking", action: "approved" }),
    ])
  })
})

describe("declineBookingRequest", () => {
  beforeEach(() => {
    getExpertBookingForApproval.mockReset()
    withAudit.mockReset()
    emitBookingNotificationEvent.mockReset()
    emitBookingNotificationEvent.mockResolvedValue({
      eventId: "evt-1",
      created: true,
    })
  })

  it("refunds 100% and releases the slot", async () => {
    const captured = captureTx()
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(
      declineBookingRequest({
        actorUserId: "expert-1",
        orgId: "org-1",
        expertProfileId: "ep-1",
        bookingId: "booking-1",
        note: "Not a match",
        source: "expert",
        now,
      })
    ).resolves.toEqual({ refundCents: 6000 })
    expect(captured.bookingSets).toEqual([
      expect.objectContaining({
        status: "cancelled",
        cancellationReason: "expert_decline: Not a match",
      }),
    ])
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 6000, status: "refund_pending" },
    ])
    expect(captured.reservationSets).toEqual([{ status: "released" }])
    expect(emitBookingNotificationEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "booking.request_declined",
        refundCents: 6000,
      })
    )
  })
})

describe("expireBookingRequests", () => {
  beforeEach(() => {
    listExpiredBookingRequests.mockReset()
    withAudit.mockReset()
    emitBookingNotificationEvent.mockReset()
    emitBookingNotificationEvent.mockResolvedValue({
      eventId: "evt-1",
      created: true,
    })
  })

  it("expires a timed-out request with a full refund", async () => {
    const captured = captureTx()
    listExpiredBookingRequests.mockResolvedValue([row()])
    await expect(expireBookingRequests({ now })).resolves.toEqual({
      scanned: 1,
      expired: 1,
      errors: 0,
    })
    expect(captured.bookingSets).toEqual([
      expect.objectContaining({
        status: "cancelled",
        cancellationReason: "request_expired",
      }),
    ])
    expect(emitBookingNotificationEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "booking.request_expired" })
    )
  })
})
