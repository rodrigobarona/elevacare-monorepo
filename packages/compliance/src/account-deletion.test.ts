import { beforeEach, describe, expect, it, vi } from "vitest"

const withPlatformAudit = vi.fn()
const withPlatformAdminContext = vi.fn()
const pseudonymiseBookingConsents = vi.fn()

vi.mock("@eleva/audit", () => ({
  withPlatformAudit: (...args: unknown[]) => withPlatformAudit(...args),
}))

vi.mock("@eleva/db", () => ({
  auth: {
    user: {
      id: "user.id",
      deletionScheduledAt: "deletion_scheduled_at",
      updatedAt: "updated_at",
    },
    member: {
      userId: "member.user_id",
      organizationId: "member.organization_id",
    },
    organization: {
      id: "organization.id",
      type: "organization.type",
    },
  },
  main: {
    accountDeletionRequests: {
      id: "adr.id",
      userId: "adr.user_id",
      status: "adr.status",
      scheduledFor: "adr.scheduled_for",
    },
    bookings: {
      id: "bookings.id",
      memberUserId: "bookings.member_user_id",
      status: "bookings.status",
      startsAt: "bookings.starts_at",
      stripePaymentIntentId: "bookings.stripe_payment_intent_id",
      reservationId: "bookings.reservation_id",
    },
    bookingPayments: {
      id: "payments.id",
      bookingId: "payments.booking_id",
      status: "payments.status",
    },
    consents: {
      userId: "consents.user_id",
      bookingId: "consents.booking_id",
    },
    slotReservations: {
      id: "slots.id",
      status: "slot_reservations.status",
    },
  },
  withPlatformAdminContext: (...args: unknown[]) =>
    withPlatformAdminContext(...args),
}))

vi.mock("./retention", async () => {
  const actual =
    await vi.importActual<typeof import("./retention")>("./retention")
  return {
    ...actual,
    pseudonymiseBookingConsents: (...args: unknown[]) =>
      pseudonymiseBookingConsents(...args),
  }
})

import {
  cancelAccountDeletion,
  scheduleAccountDeletion,
  sweepAccountDeletions,
} from "./account-deletion"

type ConsentRow = {
  id: string
  userId: string | null
  bookingId: string | null
}

function emitCtx() {
  return { emit: vi.fn(async () => undefined) }
}

describe("scheduleAccountDeletion", () => {
  beforeEach(() => {
    withPlatformAudit.mockReset()
    withPlatformAdminContext.mockReset()
    pseudonymiseBookingConsents.mockReset()
  })

  it("marks the user, inserts a pending request, and flags succeeded future payments refund_pending", async () => {
    const paymentSets: unknown[] = []
    const userSets: unknown[] = []
    const bookingSets: unknown[] = []
    let selectCalls = 0

    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          select: () => {
            selectCalls += 1
            if (selectCalls === 1) {
              return {
                from: () => ({
                  where: () => ({
                    limit: async () => [],
                  }),
                }),
              }
            }
            if (selectCalls === 2) {
              return {
                from: () => ({
                  leftJoin: () => ({
                    where: async () => [
                      {
                        id: "pending-1",
                        stripePaymentIntentId: "pi_pending",
                        reservationId: "res-1",
                        paymentStatus: "requires_payment",
                      },
                    ],
                  }),
                }),
              }
            }
            return {
              from: () => ({
                leftJoin: () => ({
                  where: async () => [
                    {
                      id: "confirmed-1",
                      paymentId: "pay-1",
                      paymentStatus: "succeeded",
                    },
                  ],
                }),
              }),
            }
          },
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "user.id") userSets.push(values)
              if (table.id === "bookings.id") bookingSets.push(values)
              if (table.id === "payments.id") paymentSets.push(values)
              return { where: async () => undefined }
            },
          }),
          insert: () => ({
            values: () => ({
              returning: async () => [{ id: "req-1" }],
            }),
          }),
        }
        return fn(tx, emitCtx())
      }
    )

    const result = await scheduleAccountDeletion({
      userId: "user-1",
      orgId: "org-1",
    })

    expect(result.requestId).toBe("req-1")
    expect(result.paymentIntentIds).toEqual(["pi_pending"])
    expect(userSets[0]).toMatchObject({ deletionScheduledAt: expect.any(Date) })
    expect(bookingSets.length).toBeGreaterThan(0)
    expect(paymentSets).toContainEqual({ status: "refund_pending" })
  })
})

describe("cancelAccountDeletion", () => {
  it("clears deletion_scheduled_at", async () => {
    const userSets: unknown[] = []
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "req-1" }],
              }),
            }),
          }),
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "user.id") userSets.push(values)
              return { where: async () => undefined }
            },
          }),
        }
        return fn(tx, emitCtx())
      }
    )

    await cancelAccountDeletion({ userId: "user-1", orgId: "org-1" })
    expect(userSets[0]).toMatchObject({ deletionScheduledAt: null })
  })
})

describe("sweepAccountDeletions", () => {
  it("catches confirm-after-mark and leaves succeeded payments refund_pending", async () => {
    const paymentSets: unknown[] = []
    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: async () => [
                    {
                      id: "req-1",
                      userId: "user-1",
                      orgId: "org-1",
                      scheduledFor: new Date("2099-01-01T00:00:00.000Z"),
                    },
                  ],
                }),
              }),
            }),
          }),
        })
    )

    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        let selectCalls = 0
        const tx = {
          select: () => {
            selectCalls += 1
            if (selectCalls === 1) {
              return {
                from: () => ({
                  leftJoin: () => ({
                    where: async () => [],
                  }),
                }),
              }
            }
            return {
              from: () => ({
                leftJoin: () => ({
                  where: async () => [
                    {
                      id: "confirmed-race",
                      paymentId: "pay-race",
                      paymentStatus: "succeeded",
                    },
                  ],
                }),
              }),
            }
          },
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "payments.id") paymentSets.push(values)
              return { where: async () => undefined }
            },
          }),
          delete: () => ({ where: async () => undefined }),
        }
        return fn(tx, emitCtx())
      }
    )

    const now = new Date("2026-09-11T00:00:00.000Z")
    const result = await sweepAccountDeletions(now)
    expect(result.completed).toBe(0)
    expect(paymentSets).toEqual([{ status: "refund_pending" }])
  })

  it("after a due sweep, account-scope rows are 0 and booking-scope stay counted with user_id null", async () => {
    const consents: ConsentRow[] = [
      { id: "a1", userId: "user-1", bookingId: null },
      { id: "a2", userId: "user-1", bookingId: null },
      { id: "b1", userId: "user-1", bookingId: "booking-1" },
      { id: "b2", userId: "user-1", bookingId: "booking-2" },
    ]
    const bookingScopeBefore = consents.filter((row) => row.bookingId).length

    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: async () => [
                    {
                      id: "req-1",
                      userId: "user-1",
                      orgId: "org-1",
                      scheduledFor: new Date("2026-01-01T00:00:00.000Z"),
                    },
                  ],
                }),
              }),
            }),
          }),
        })
    )

    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          select: () => ({
            from: () => ({
              leftJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
          update: () => ({ set: () => ({ where: async () => undefined }) }),
          delete: () => ({
            where: async () => {
              for (let i = consents.length - 1; i >= 0; i--) {
                const row = consents[i]!
                if (row.userId === "user-1" && row.bookingId == null) {
                  consents.splice(i, 1)
                }
              }
            },
          }),
        }
        pseudonymiseBookingConsents.mockImplementation(
          async (userId: string) => {
            for (const row of consents) {
              if (row.userId === userId && row.bookingId) {
                row.userId = null
              }
            }
          }
        )
        return fn(tx, emitCtx())
      }
    )

    const result = await sweepAccountDeletions(
      new Date("2026-09-11T00:00:00.000Z")
    )
    expect(result.completed).toBe(1)
    expect(consents.filter((row) => row.bookingId == null)).toHaveLength(0)
    expect(consents.filter((row) => row.bookingId)).toHaveLength(
      bookingScopeBefore
    )
    expect(consents.every((row) => row.userId === null)).toBe(true)
  })
})
