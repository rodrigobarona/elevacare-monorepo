import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ExpertCancelError,
  cancelBookingByExpert,
  expertCancelReason,
} from "./expert-cancel"

const getExpertBookingForApproval = vi.fn()
const withAudit = vi.fn()
const emitBookingNotificationEvent = vi.fn()

vi.mock("@eleva/db", () => ({
  getExpertBookingForApproval: (...args: unknown[]) =>
    getExpertBookingForApproval(...args),
  main: {
    bookings: {
      id: "bookings.id",
      orgId: "bookings.org_id",
      expertProfileId: "bookings.expert_profile_id",
      status: "bookings.status",
      startsAt: "bookings.starts_at",
    },
    bookingPayments: {
      id: "payments.id",
      status: "payments.status",
      refundedCents: "payments.refunded_cents",
    },
    slotReservations: { id: "slots.id", status: "slots.status" },
  },
}))

vi.mock("@eleva/audit", () => ({
  withAudit: (...args: unknown[]) => withAudit(...args),
}))

vi.mock("./emit-domain-event", () => ({
  emitBookingNotificationEvent: (...args: unknown[]) =>
    emitBookingNotificationEvent(...args),
}))

const now = new Date("2026-11-11T10:00:00.000Z")

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    orgId: "org-1",
    status: "confirmed",
    startsAt: new Date("2026-11-20T10:00:00.000Z"),
    endsAt: new Date("2026-11-20T10:50:00.000Z"),
    eventTypeId: "et-1",
    expertProfileId: "ep-1",
    memberUserId: "member-1",
    sessionMode: "online",
    reservationId: "res-1",
    requiresApproval: false,
    approvalDeadlineAt: null,
    paymentId: "pay-1",
    paymentStatus: "succeeded",
    paymentAmountCents: 6000,
    paymentRefundedCents: 0,
    ...overrides,
  }
}

/** Every string inside a drizzle condition: the columns it compares. */
function columnsIn(condition: unknown, seen = new Set<unknown>()): string[] {
  if (typeof condition === "string") return [condition]
  if (!condition || typeof condition !== "object" || seen.has(condition)) {
    return []
  }
  seen.add(condition)
  return Object.values(condition).flatMap((value) => columnsIn(value, seen))
}

/** Runs the audited write against a fake transaction and records it. */
function captureTx(
  options: { bookingUpdated?: boolean; paymentUpdated?: boolean } = {}
) {
  const captured = {
    bookingSets: [] as unknown[],
    paymentSets: [] as unknown[],
    reservationSets: [] as unknown[],
    audits: [] as unknown[],
    auditOptions: [] as unknown[],
    /** Columns each update is guarded on, by table. */
    guards: {} as Record<string, string[]>,
  }
  withAudit.mockImplementation(
    async (
      opts: unknown,
      fn: (tx: unknown, ctx: { emit: (e: unknown) => Promise<void> }) => unknown
    ) => {
      captured.auditOptions.push(opts)
      return fn(
        {
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "bookings.id") captured.bookingSets.push(values)
              if (table.id === "payments.id") captured.paymentSets.push(values)
              if (table.id === "slots.id") captured.reservationSets.push(values)
              const updated =
                (table.id !== "bookings.id" ||
                  options.bookingUpdated !== false) &&
                (table.id !== "payments.id" || options.paymentUpdated !== false)
              return {
                where: (condition: unknown) => {
                  captured.guards[table.id] = columnsIn(condition)
                  return {
                    returning: async () => (updated ? [{ id: "row-1" }] : []),
                  }
                },
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
    }
  )
  return captured
}

const input = {
  actorUserId: "expert-1",
  orgId: "org-1",
  expertProfileId: "ep-1",
  bookingId: "booking-1",
  now,
}

describe("cancelBookingByExpert", () => {
  // The clock is fixed, so these do not depend on the day they are run.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    getExpertBookingForApproval.mockReset()
    withAudit.mockReset()
    emitBookingNotificationEvent.mockReset()
    emitBookingNotificationEvent.mockResolvedValue({
      eventId: "evt-1",
      created: true,
    })
  })

  it("cancels, refunds everything paid, frees the time and tells both", async () => {
    const captured = captureTx()
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(
      cancelBookingByExpert({ ...input, reason: "unavailable" })
    ).resolves.toEqual({ refundCents: 6000, alreadyCancelled: false })

    // Each write only lands on the row as it was read.
    expect(captured.guards["bookings.id"]).toEqual(
      expect.arrayContaining([
        "bookings.id",
        "bookings.org_id",
        "bookings.expert_profile_id",
        "bookings.status",
        "bookings.starts_at",
      ])
    )
    expect(captured.guards["payments.id"]).toEqual(
      expect.arrayContaining([
        "payments.id",
        "payments.status",
        "payments.refunded_cents",
      ])
    )
    expect(captured.auditOptions).toEqual([
      { orgId: "org-1", actorUserId: "expert-1" },
    ])
    expect(captured.bookingSets).toEqual([
      {
        status: "cancelled",
        cancellationReason: "expert_cancel:unavailable",
        cancelledAt: now,
        updatedAt: now,
      },
    ])
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 6000, status: "refund_pending" },
    ])
    expect(captured.reservationSets).toEqual([{ status: "released" }])
    expect(emitBookingNotificationEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        orgId: "org-1",
        type: "booking.cancelled",
        bookingId: "booking-1",
        startsAt: row().startsAt,
        occurredAt: now,
        cancelledBy: "expert",
        refundCents: 6000,
      }
    )
    expect(captured.audits).toEqual([
      {
        entity: "booking",
        action: "canceled",
        entityId: "booking-1",
        payload: {
          reason: "expert_cancel",
          refundPercent: 100,
          refundCents: 6000,
        },
      },
    ])
  })

  it("refunds in full whatever the service's policy would give the member", async () => {
    captureTx()
    // One hour before the start: a Strict policy would refund the member nothing.
    getExpertBookingForApproval.mockResolvedValue(
      row({ startsAt: new Date("2026-11-11T11:00:00.000Z") })
    )
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 6000,
      alreadyCancelled: false,
    })
  })

  it("refunds only what has not been refunded already", async () => {
    const captured = captureTx()
    getExpertBookingForApproval.mockResolvedValue(
      row({ paymentRefundedCents: 2000 })
    )
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 4000,
      alreadyCancelled: false,
    })
    expect(captured.paymentSets).toEqual([
      { refundDueCents: 6000, status: "refund_pending" },
    ])
  })

  it("cancels a free session without touching any payment", async () => {
    const captured = captureTx()
    getExpertBookingForApproval.mockResolvedValue(
      row({
        paymentId: null,
        paymentStatus: null,
        paymentAmountCents: null,
        paymentRefundedCents: null,
      })
    )
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 0,
      alreadyCancelled: false,
    })
    expect(captured.paymentSets).toEqual([])
    const [, event] = emitBookingNotificationEvent.mock.calls[0] ?? []
    expect(event).toMatchObject({ cancelledBy: "expert" })
    expect(event).not.toHaveProperty("refundCents")
    // No percentage is recorded when nothing was paid.
    expect(captured.audits).toEqual([
      expect.objectContaining({
        payload: { reason: "expert_cancel", refundCents: 0 },
      }),
    ])
  })

  it("also cancels a session that was moved to a new time", async () => {
    captureTx()
    getExpertBookingForApproval.mockResolvedValue(
      row({ status: "rescheduled" })
    )
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 6000,
      alreadyCancelled: false,
    })
  })

  it("says it was already cancelled, with nothing more to refund", async () => {
    getExpertBookingForApproval.mockResolvedValue(row({ status: "cancelled" }))
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 0,
      alreadyCancelled: true,
    })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("gives two presses at the same moment the same answer", async () => {
    // The second press read "confirmed", then lost the write to the first.
    captureTx({ bookingUpdated: false })
    getExpertBookingForApproval
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "cancelled" }))
    await expect(cancelBookingByExpert(input)).resolves.toEqual({
      refundCents: 0,
      alreadyCancelled: true,
    })
    expect(emitBookingNotificationEvent).not.toHaveBeenCalled()
  })

  it("does not cancel a session the member has moved since the expert looked", async () => {
    getExpertBookingForApproval.mockResolvedValue(
      row({ startsAt: new Date("2026-11-21T15:00:00.000Z") })
    )
    await expect(
      cancelBookingByExpert({
        ...input,
        expectedStartsAt: new Date("2026-11-20T10:00:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "SESSION_CHANGED" })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("cancels when the session is still where the expert saw it", async () => {
    captureTx()
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(
      cancelBookingByExpert({ ...input, expectedStartsAt: row().startsAt })
    ).resolves.toMatchObject({ alreadyCancelled: false })
  })

  it("refuses a booking of another expert or organisation", async () => {
    getExpertBookingForApproval.mockResolvedValue(null)
    await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
      code: "not_found",
    })
    expect(getExpertBookingForApproval).toHaveBeenCalledWith({
      orgId: "org-1",
      expertProfileId: "ep-1",
      bookingId: "booking-1",
    })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("refuses what is not a confirmed session", async () => {
    for (const status of [
      "awaiting_confirmation",
      "pending_payment",
      "completed",
      "no_show",
      "refunded",
    ]) {
      getExpertBookingForApproval.mockResolvedValue(row({ status }))
      await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
        code: "INVALID_STATUS",
      })
    }
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("refuses once the session has started", async () => {
    getExpertBookingForApproval.mockResolvedValue(row({ startsAt: now }))
    await expect(cancelBookingByExpert(input)).rejects.toBeInstanceOf(
      ExpertCancelError
    )
    await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
      code: "TOO_LATE",
    })
    expect(withAudit).not.toHaveBeenCalled()
  })

  it("refuses a session that starts while the cancellation is being written", async () => {
    // Read one second before the start; at the write the database's clock
    // is past it, so the write changes nothing.
    captureTx({ bookingUpdated: false })
    const startsAt = new Date(now.getTime() + 1000)
    getExpertBookingForApproval.mockResolvedValue(row({ startsAt }))
    // The call reads `now` from its input; the late check reads the clock.
    vi.setSystemTime(new Date(startsAt.getTime() + 1000))
    await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
      code: "TOO_LATE",
    })
    expect(emitBookingNotificationEvent).not.toHaveBeenCalled()
  })

  it("changes nothing when a refund started meanwhile", async () => {
    // The payment is no longer as it was read: the guard fails, the error
    // leaves the transaction, and the cancellation is rolled back with it.
    const captured = captureTx({ paymentUpdated: false })
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
      code: "INVALID_STATUS",
    })
    expect(captured.reservationSets).toEqual([])
    expect(emitBookingNotificationEvent).not.toHaveBeenCalled()
    expect(captured.audits).toEqual([])
  })

  it("changes nothing when the member moved or cancelled first", async () => {
    const captured = captureTx({ bookingUpdated: false })
    getExpertBookingForApproval.mockResolvedValue(row())
    await expect(cancelBookingByExpert(input)).rejects.toMatchObject({
      code: "INVALID_STATUS",
    })
    expect(captured.paymentSets).toEqual([])
    expect(captured.reservationSets).toEqual([])
    expect(emitBookingNotificationEvent).not.toHaveBeenCalled()
    expect(captured.audits).toEqual([])
  })
})

describe("expertCancelReason", () => {
  it("stores a reason from the list, and never free text", () => {
    expect(expertCancelReason()).toBe("expert_cancel")
    expect(expertCancelReason("emergency")).toBe("expert_cancel:emergency")
    expect(expertCancelReason("scheduling")).toBe("expert_cancel:scheduling")
    // Anything else (an older client, typed words) is dropped.
    expect(expertCancelReason("I have the flu")).toBe("expert_cancel")
    expect(expertCancelReason("   ")).toBe("expert_cancel")
  })
})
