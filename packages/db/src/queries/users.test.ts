import { beforeEach, describe, expect, it, vi } from "vitest"

const { memberRows, withPlatformAdminContext } = vi.hoisted(() => {
  const memberRows: { value: unknown[] } = { value: [] }
  const tx = {
    select: () => tx,
    from: () => tx,
    where: () => tx,
    limit: async () => memberRows.value,
  }
  return {
    memberRows,
    withPlatformAdminContext: vi.fn(
      async (fn: (handle: typeof tx) => Promise<unknown>) => fn(tx)
    ),
  }
})

vi.mock("../context", () => ({ withPlatformAdminContext }))

import { isActiveBookingExpert } from "./users"

const booking = { orgId: "clinic-1", expertUserId: "expert-1" }

describe("isActiveBookingExpert", () => {
  beforeEach(() => {
    withPlatformAdminContext.mockClear()
    memberRows.value = []
  })

  it("is the booking's expert while still a member of its org", async () => {
    memberRows.value = [{ id: "m-1" }]
    await expect(isActiveBookingExpert(booking, "expert-1")).resolves.toBe(true)
  })

  it("drops a booking's expert once removed from its org", async () => {
    memberRows.value = []
    await expect(isActiveBookingExpert(booking, "expert-1")).resolves.toBe(
      false
    )
  })

  it("never matches anyone else and skips the membership read", async () => {
    memberRows.value = [{ id: "m-1" }]
    await expect(isActiveBookingExpert(booking, "member-1")).resolves.toBe(
      false
    )
    await expect(isActiveBookingExpert(booking, null)).resolves.toBe(false)
    await expect(
      isActiveBookingExpert({ ...booking, expertUserId: null }, "expert-1")
    ).resolves.toBe(false)
    expect(withPlatformAdminContext).not.toHaveBeenCalled()
  })
})
