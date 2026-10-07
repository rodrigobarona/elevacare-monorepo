import { describe, expect, it, vi } from "vitest"
import { ensureSessionRow } from "./ensure-session-row"

const booking = {
  id: "22222222-2222-4222-8222-222222222222",
  orgId: "44444444-4444-4444-8444-444444444444",
  eventTypeId: "55555555-5555-4555-8555-555555555555",
  expertProfileId: "66666666-6666-4666-8666-666666666666",
  memberUserId: "77777777-7777-4777-8777-777777777777",
  startsAt: new Date("2026-10-08T10:00:00.000Z"),
  endsAt: new Date("2026-10-08T10:50:00.000Z"),
  sessionMode: "online" as const,
}

describe("ensureSessionRow", () => {
  it("skips guest bookings without a member", async () => {
    const insert = vi.fn()
    const created = await ensureSessionRow({ insert } as never, {
      ...booking,
      memberUserId: null,
    })
    expect(created).toEqual({ created: false })
    expect(insert).not.toHaveBeenCalled()
  })

  it("inserts a scheduled session and treats a conflict as already created", async () => {
    const insert = vi.fn(() => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [{ id: "ses-1" }],
        }),
      }),
    }))
    const created = await ensureSessionRow({ insert } as never, booking)
    expect(created).toEqual({ created: true })
    expect(insert).toHaveBeenCalledTimes(1)

    const replay = vi.fn(() => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    }))
    expect(
      await ensureSessionRow({ insert: replay } as never, booking)
    ).toEqual({ created: false })
  })
})
