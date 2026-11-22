import { describe, expect, it, vi } from "vitest"
import {
  syncSeatQuantity,
  type CurrentClinicSubscription,
  type SeatGateway,
} from "./seats"

const SUB = "sub_current"

/** A Stripe that records what it was asked, in order. */
function gateway(overrides: Partial<SeatGateway> = {}) {
  const calls: string[] = []
  const stripe: SeatGateway = {
    setQuantity: vi.fn(async (itemId, quantity) => {
      calls.push(`set ${itemId} ${quantity}`)
    }),
    ensureSeatItem: vi.fn(async (subscriptionId, quantity) => {
      calls.push(`ensure ${subscriptionId} ${quantity}`)
      return { itemId: "si_new", created: true }
    }),
    ...overrides,
  }
  return { stripe, calls }
}

function clinic(
  subscription: CurrentClinicSubscription | null,
  seats: number,
  stripe: SeatGateway
) {
  return {
    getOrgType: async () => "team",
    getCurrentSubscription: async () => subscription,
    countSeats: async () => seats,
    gateway: stripe,
  }
}

const gone = Object.assign(new Error("No such subscription_item"), {
  code: "resource_missing",
})

describe("syncSeatQuantity", () => {
  it("does nothing for an organization that is not a clinic", async () => {
    const { stripe, calls } = gateway()
    const result = await syncSeatQuantity("org_1", {
      ...clinic({ stripeSubscriptionId: SUB, seatItemId: "si_1" }, 2, stripe),
      getOrgType: async () => "expert",
    })
    expect(result).toEqual({ synced: false })
    expect(calls).toEqual([])
  })

  it("does nothing, and asks Stripe nothing, without a current subscription", async () => {
    // None, never paid, expired, canceled, unpaid: the mirror read returns
    // no row for all of them, and nothing is left to retry.
    const { stripe, calls } = gateway()
    await expect(
      syncSeatQuantity("org_1", clinic(null, 3, stripe))
    ).resolves.toEqual({ synced: false })
    expect(calls).toEqual([])
  })

  it.each([
    ["no seats", 0],
    ["a first seat", 1],
    ["fewer seats than before", 2],
  ])("sets the seat item to the count: %s", async (_name, seats) => {
    const { stripe, calls } = gateway()
    const result = await syncSeatQuantity(
      "org_1",
      clinic(
        { stripeSubscriptionId: SUB, seatItemId: "si_seat" },
        seats,
        stripe
      )
    )
    expect(result).toEqual({ synced: true, quantity: seats })
    // Zero is a number: the item stays, at 0.
    expect(calls).toEqual([`set si_seat ${seats}`])
  })

  it("creates the seat item when the subscription has none, at the count", async () => {
    const { stripe, calls } = gateway()
    const result = await syncSeatQuantity(
      "org_1",
      clinic({ stripeSubscriptionId: SUB, seatItemId: null }, 1, stripe)
    )
    // Created at the count, so no second call; the caller stores the id.
    expect(calls).toEqual([`ensure ${SUB} 1`])
    expect(result).toEqual({
      synced: true,
      quantity: 1,
      seatItem: { stripeSubscriptionId: SUB, itemId: "si_new", created: true },
    })
  })

  it("creates it at zero for a clinic with no seats", async () => {
    const { stripe, calls } = gateway()
    const result = await syncSeatQuantity(
      "org_1",
      clinic({ stripeSubscriptionId: SUB, seatItemId: null }, 0, stripe)
    )
    expect(calls).toEqual([`ensure ${SUB} 0`])
    expect(result).toMatchObject({ synced: true, quantity: 0 })
  })

  it("uses the item Stripe already has when the mirror is behind, and creates nothing", async () => {
    const { stripe, calls } = gateway({
      ensureSeatItem: vi.fn(async () => ({
        itemId: "si_there",
        created: false,
      })),
    })
    const result = await syncSeatQuantity(
      "org_1",
      clinic({ stripeSubscriptionId: SUB, seatItemId: null }, 4, stripe)
    )
    expect(calls).toEqual(["set si_there 4"])
    expect(result.seatItem).toEqual({
      stripeSubscriptionId: SUB,
      itemId: "si_there",
      created: false,
    })
  })

  it("stops cleanly when Stripe says the subscription is not current", async () => {
    // The mirror still says active (the webhook is late); Stripe knows better.
    const { stripe } = gateway({ ensureSeatItem: vi.fn(async () => null) })
    await expect(
      syncSeatQuantity(
        "org_1",
        clinic({ stripeSubscriptionId: SUB, seatItemId: null }, 2, stripe)
      )
    ).resolves.toEqual({ synced: false })
  })

  it("asks Stripe again when the item the mirror knows is gone", async () => {
    const { stripe, calls } = gateway({
      setQuantity: vi.fn(async () => {
        throw gone
      }),
    })
    const result = await syncSeatQuantity(
      "org_1",
      clinic({ stripeSubscriptionId: SUB, seatItemId: "si_old" }, 2, stripe)
    )
    expect(calls).toEqual([`ensure ${SUB} 2`])
    expect(result).toMatchObject({
      synced: true,
      seatItem: { itemId: "si_new" },
    })
  })

  it("ends without an error when the subscription itself is gone", async () => {
    const { stripe } = gateway({
      setQuantity: vi.fn(async () => {
        throw gone
      }),
      ensureSeatItem: vi.fn(async () => {
        throw gone
      }),
    })
    // Not thrown: the same answer would come back every ten minutes.
    await expect(
      syncSeatQuantity(
        "org_1",
        clinic({ stripeSubscriptionId: SUB, seatItemId: "si_old" }, 2, stripe)
      )
    ).resolves.toEqual({ synced: false })
    expect(stripe.ensureSeatItem).toHaveBeenCalledTimes(1)
  })

  it("throws after three tries when Stripe cannot be reached, so the mark stays", async () => {
    const setQuantity = vi.fn(async () => {
      throw Object.assign(new Error("connection reset"), {
        type: "StripeConnectionError",
      })
    })
    const { stripe } = gateway({ setQuantity })
    await expect(
      syncSeatQuantity(
        "org_1",
        clinic({ stripeSubscriptionId: SUB, seatItemId: "si_seat" }, 2, stripe)
      )
    ).rejects.toThrow("connection reset")
    expect(setQuantity).toHaveBeenCalledTimes(3)
  })

  it("recounts on a retry, so the last write is the latest count", async () => {
    let seats = 1
    const setQuantity = vi
      .fn<SeatGateway["setQuantity"]>()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(undefined)
    const { stripe } = gateway({ setQuantity })
    const result = await syncSeatQuantity("org_1", {
      ...clinic(
        { stripeSubscriptionId: SUB, seatItemId: "si_seat" },
        0,
        stripe
      ),
      countSeats: async () => seats++,
    })
    expect(setQuantity.mock.calls).toEqual([
      ["si_seat", 1],
      ["si_seat", 2],
    ])
    expect(result.quantity).toBe(2)
  })

  it("runs two syncs of one clinic one after the other, and creates one item", async () => {
    let known: string | null = null
    let running = 0
    let overlapped = false
    const ensureSeatItem = vi.fn(async () => {
      running += 1
      overlapped ||= running > 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      const created = known === null
      known = "si_new"
      return { itemId: "si_new", created }
    })
    const { stripe } = gateway({ ensureSeatItem })
    const deps = clinic(
      { stripeSubscriptionId: SUB, seatItemId: null },
      1,
      stripe
    )
    const [first, second] = await Promise.all([
      syncSeatQuantity("org_same", deps),
      syncSeatQuantity("org_same", deps),
    ])
    expect(overlapped).toBe(false)
    expect([first.seatItem?.created, second.seatItem?.created]).toEqual([
      true,
      false,
    ])
  })
})
