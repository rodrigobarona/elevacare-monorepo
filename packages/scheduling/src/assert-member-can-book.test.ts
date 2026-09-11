import { beforeEach, describe, expect, it, vi } from "vitest"
import { BookingError, assertMemberCanBook } from "./assert-member-can-book"

const withPlatformAdminContext = vi.fn()

vi.mock("@eleva/db/context", () => ({
  withPlatformAdminContext: (fn: (tx: unknown) => unknown) =>
    withPlatformAdminContext(fn),
}))

vi.mock("@eleva/db/schema/auth", () => ({
  user: {
    id: "id",
    banned: "banned",
    deletionScheduledAt: "deletion_scheduled_at",
  },
}))

function mockMember(
  row: { banned: boolean; deletionScheduledAt: Date | null } | undefined
) {
  withPlatformAdminContext.mockImplementation(
    async (fn: (tx: { select: () => unknown }) => Promise<unknown[]>) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => (row ? [row] : []),
            }),
          }),
        }),
      })
  )
}

describe("assertMemberCanBook", () => {
  beforeEach(() => {
    withPlatformAdminContext.mockReset()
  })

  it("allows a member who is not banned and has no deletion scheduled", async () => {
    mockMember({ banned: false, deletionScheduledAt: null })
    await expect(assertMemberCanBook("user-1")).resolves.toBeUndefined()
  })

  it("throws ACCOUNT_DELETION_SCHEDULED when deletion is pending", async () => {
    mockMember({
      banned: false,
      deletionScheduledAt: new Date("2026-09-25T00:00:00Z"),
    })
    await expect(assertMemberCanBook("user-1")).rejects.toMatchObject({
      name: "BookingError",
      code: "ACCOUNT_DELETION_SCHEDULED",
    })
  })

  it("throws ACCOUNT_BANNED for a banned or missing member", async () => {
    mockMember({ banned: true, deletionScheduledAt: null })
    await expect(assertMemberCanBook("user-1")).rejects.toBeInstanceOf(
      BookingError
    )
    await expect(assertMemberCanBook("user-1")).rejects.toMatchObject({
      code: "ACCOUNT_BANNED",
    })

    mockMember(undefined)
    await expect(assertMemberCanBook("missing")).rejects.toMatchObject({
      code: "ACCOUNT_BANNED",
    })
  })
})
