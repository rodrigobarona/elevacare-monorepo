import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  withOrgContext,
  withAudit,
  provisionPersonalSpace,
  requestMagicLinkSignIn,
  hashGuestEmail,
  dbSelectLimit,
  innerJoinLimit,
} = vi.hoisted(() => ({
  withOrgContext: vi.fn(),
  withAudit: vi.fn(),
  provisionPersonalSpace: vi.fn(),
  requestMagicLinkSignIn: vi.fn(),
  hashGuestEmail: vi.fn(() => "guest-hash"),
  dbSelectLimit: vi.fn(),
  innerJoinLimit: vi.fn(),
}))

vi.mock("@eleva/db", () => ({
  auth: {
    user: { id: "id", name: "name", email: "email" },
    organization: { id: "id", type: "type" },
    member: { userId: "user_id", organizationId: "organization_id" },
  },
  main: {
    bookings: {
      id: "id",
      orgId: "org_id",
      memberUserId: "member_user_id",
      guestEmail: "guest_email",
      guestName: "guest_name",
      status: "status",
      guestActivationSentAt: "guest_activation_sent_at",
    },
    consents: {
      orgId: "org_id",
      guestEmailHash: "guest_email_hash",
      userId: "user_id",
    },
  },
  db: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: dbSelectLimit }),
        innerJoin: () => ({
          where: () => ({ limit: innerJoinLimit }),
        }),
      }),
    }),
  }),
  withOrgContext,
}))

vi.mock("@eleva/audit", () => ({
  withAudit,
}))

vi.mock("@eleva/auth", () => ({
  provisionPersonalSpace,
}))

vi.mock("@eleva/auth/server/auth", () => ({
  requestMagicLinkSignIn,
}))

vi.mock("@eleva/compliance", () => ({
  hashGuestEmail,
}))

import { activateGuestBooking } from "./guest-activation"

describe("activateGuestBooking consent re-key", () => {
  beforeEach(() => {
    withOrgContext.mockReset()
    withAudit.mockReset()
    provisionPersonalSpace.mockReset()
    requestMagicLinkSignIn.mockReset()
    dbSelectLimit.mockReset()
    innerJoinLimit.mockReset()
    hashGuestEmail.mockReturnValue("guest-hash")
  })

  it("re-keys guest consents onto the activated user id", async () => {
    withOrgContext.mockImplementation(
      async (_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "booking-1",
                    orgId: "org-1",
                    memberUserId: null,
                    guestEmail: "ada@eleva.care",
                    guestName: "Ada",
                    status: "confirmed",
                    guestActivationSentAt: null,
                  },
                ],
              }),
            }),
          }),
        })
    )
    dbSelectLimit.mockResolvedValue([{ id: "user-1", name: "Ada" }])
    innerJoinLimit.mockResolvedValue([{ orgId: "space-1" }])

    const consentSets: Array<Record<string, unknown>> = []
    const emit = vi.fn()
    withAudit.mockImplementation(
      async (
        _opts: unknown,
        fn: (
          tx: {
            update: () => {
              set: (values: Record<string, unknown>) => {
                where: () => {
                  then: (
                    onFulfilled: (value: unknown) => unknown,
                    onRejected?: (reason: unknown) => unknown
                  ) => Promise<unknown>
                  returning: () => Promise<{ id: string }[]>
                }
              }
            }
          },
          ctx: { emit: typeof emit }
        ) => Promise<void>
      ) => {
        const tx = {
          update: () => ({
            set: (values: Record<string, unknown>) => {
              if ("userId" in values) consentSets.push(values)
              return {
                where: () => ({
                  then: (
                    onFulfilled: (value: unknown) => unknown,
                    onRejected?: (reason: unknown) => unknown
                  ) => Promise.resolve(undefined).then(onFulfilled, onRejected),
                  returning: async () => [{ id: "booking-1" }],
                }),
              }
            },
          }),
        }
        return fn(tx, { emit })
      }
    )

    await activateGuestBooking({
      orgId: "org-1",
      bookingId: "booking-1",
      reservationId: "reservation-1",
    })

    expect(hashGuestEmail).toHaveBeenCalledWith("ada@eleva.care")
    expect(consentSets).toEqual([
      { userId: "user-1", subjectKind: "user", guestEmailHash: null },
    ])
    expect(provisionPersonalSpace).toHaveBeenCalledWith({
      id: "user-1",
      name: "Ada",
    })
  })
})
