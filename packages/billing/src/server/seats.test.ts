import { describe, expect, it, vi } from "vitest"
import { syncSeatQuantity } from "./seats"

describe("syncSeatQuantity", () => {
  it("no-ops when the org is not a team", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "expert",
      getSeatItemId: async () => "si_1",
      countSeats: async () => 2,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: false })
    expect(updateSeatItem).not.toHaveBeenCalled()
  })

  it("no-ops when there is no billing subscription seat item", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "team",
      getSeatItemId: async () => null,
      countSeats: async () => 1,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: false })
    expect(updateSeatItem).not.toHaveBeenCalled()
  })

  it("sets quantity 0 when the owner has no published event type", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "team",
      getSeatItemId: async () => "si_seat",
      countSeats: async () => 0,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: true, quantity: 0 })
    expect(updateSeatItem).toHaveBeenCalledWith("si_seat", 0)
  })

  it("increments when a member publishes an event type", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "team",
      getSeatItemId: async () => "si_seat",
      countSeats: async () => 1,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: true, quantity: 1 })
    expect(updateSeatItem).toHaveBeenCalledWith("si_seat", 1)
  })

  it("decrements when the last event type is unpublished", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "team",
      getSeatItemId: async () => "si_seat",
      countSeats: async () => 0,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: true, quantity: 0 })
    expect(updateSeatItem).toHaveBeenCalledWith("si_seat", 0)
  })

  it("decrements when a billable member is removed", async () => {
    const updateSeatItem = vi.fn()
    const result = await syncSeatQuantity("org_1", {
      getOrgType: async () => "team",
      getSeatItemId: async () => "si_seat",
      countSeats: async () => 0,
      updateSeatItem,
    })
    expect(result).toEqual({ synced: true, quantity: 0 })
    expect(updateSeatItem).toHaveBeenCalledWith("si_seat", 0)
  })
})
