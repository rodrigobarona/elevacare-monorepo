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
      name: "user.name",
      email: "user.email",
      emailVerified: "user.email_verified",
      image: "user.image",
      timezone: "user.timezone",
      locale: "user.locale",
      banned: "user.banned",
      banReason: "user.ban_reason",
    },
    session: {
      id: "session.id",
      userId: "session.user_id",
    },
    account: {
      id: "account.id",
      userId: "account.user_id",
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
    notificationPreferences: {
      userId: "prefs.user_id",
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
  anonymisedAccountEmail,
  cancelAccountDeletion,
  getPendingAccountDeletion,
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
          execute: async () => undefined,
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
            if (selectCalls === 3) {
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
            }
            return {
              from: () => ({
                leftJoin: () => ({
                  where: async () => [
                    {
                      stripePaymentIntentId: "pi_pending",
                      paymentStatus: "requires_payment",
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
              return {
                where: () => ({
                  returning: async () => [],
                }),
              }
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

  it("maps a concurrent pending-user unique violation to AccountDeletionConflictError", async () => {
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          execute: async () => undefined,
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: async () => undefined,
            }),
          }),
          insert: () => ({
            values: () => ({
              returning: async () => {
                throw Object.assign(new Error("duplicate key"), {
                  code: "23505",
                })
              },
            }),
          }),
        }
        return fn(tx, emitCtx())
      }
    )

    await expect(
      scheduleAccountDeletion({ userId: "user-1", orgId: "org-1" })
    ).rejects.toMatchObject({ code: "ACCOUNT_DELETION_ALREADY_SCHEDULED" })
  })
})

describe("cancelAccountDeletion", () => {
  it("clears deletion_scheduled_at", async () => {
    const userSets: unknown[] = []
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        const tx = {
          execute: async () => undefined,
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "user.id") userSets.push(values)
              return {
                where: () => ({
                  returning: async () =>
                    table.id === "adr.id" ? [{ id: "req-1" }] : [],
                }),
              }
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
          execute: async () => undefined,
          select: () => {
            selectCalls += 1
            if (selectCalls === 1) {
              return {
                from: () => ({
                  where: () => ({
                    limit: async () => [{ id: "req-1" }],
                  }),
                }),
              }
            }
            if (selectCalls === 2) {
              return {
                from: () => ({
                  leftJoin: () => ({
                    where: async () => [],
                  }),
                }),
              }
            }
            if (selectCalls === 3) {
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
            }
            return {
              from: () => ({
                leftJoin: () => ({
                  where: async () => [],
                }),
              }),
            }
          },
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "payments.id") paymentSets.push(values)
              return {
                where: () => ({
                  returning: async () => [{ id: "req-1" }],
                }),
              }
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
    const ops: string[] = []
    const userSets: unknown[] = []

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
          execute: async () => undefined,
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "req-1" }],
              }),
              leftJoin: () => ({
                where: async () => [],
              }),
            }),
          }),
          update: (table: { id: string }) => ({
            set: (values: Record<string, unknown>) => {
              if (table.id === "user.id") {
                ops.push("anonymise")
                userSets.push(values)
              }
              if (table.id === "adr.id" && values.status === "completed") {
                ops.push("complete")
              }
              return {
                where: () => ({
                  returning: async () => [{ id: "req-1" }],
                }),
              }
            },
          }),
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
    expect(ops.indexOf("anonymise")).toBeGreaterThanOrEqual(0)
    expect(ops.indexOf("anonymise")).toBeLessThan(ops.indexOf("complete"))
    expect(userSets[0]).toMatchObject({
      email: anonymisedAccountEmail("user-1"),
      banned: true,
      name: "Deleted member",
    })
  })

  it("does not complete a due request while cancelable PaymentIntents remain", async () => {
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

    const statusSets: unknown[] = []
    withPlatformAudit.mockImplementation(
      async (_opts: unknown, fn: (tx: unknown, ctx: unknown) => unknown) => {
        let selectCalls = 0
        const tx = {
          execute: async () => undefined,
          select: () => {
            selectCalls += 1
            if (selectCalls === 1) {
              return {
                from: () => ({
                  where: () => ({
                    limit: async () => [{ id: "req-1" }],
                  }),
                }),
              }
            }
            if (selectCalls === 2 || selectCalls === 3) {
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
                      stripePaymentIntentId: "pi_stuck",
                      paymentStatus: "requires_payment",
                    },
                  ],
                }),
              }),
            }
          },
          update: (table: { id: string }) => ({
            set: (values: unknown) => {
              if (table.id === "adr.id") statusSets.push(values)
              return {
                where: () => ({
                  returning: async () => [{ id: "req-1" }],
                }),
              }
            },
          }),
          delete: () => ({ where: async () => undefined }),
        }
        return fn(tx, emitCtx())
      }
    )

    const result = await sweepAccountDeletions(
      new Date("2026-09-11T00:00:00.000Z")
    )
    expect(result.completed).toBe(0)
    expect(result.paymentIntentIds).toEqual(["pi_stuck"])
    expect(result.awaitingCompletion).toEqual([
      { id: "req-1", userId: "user-1", orgId: "org-1" },
    ])
    expect(statusSets).not.toContainEqual({ status: "completed" })
  })
})

describe("getPendingAccountDeletion", () => {
  beforeEach(() => {
    withPlatformAdminContext.mockReset()
  })

  it("returns the pending request that has not reached scheduledFor", async () => {
    const scheduledFor = new Date("2099-01-01T00:00:00.000Z")
    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: "req-1", scheduledFor }],
              }),
            }),
          }),
        })
    )

    await expect(getPendingAccountDeletion("user-1")).resolves.toEqual({
      requestId: "req-1",
      scheduledFor,
    })
  })

  it("returns null when no pending request exists", async () => {
    withPlatformAdminContext.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        })
    )

    await expect(getPendingAccountDeletion("user-1")).resolves.toBeNull()
  })
})
