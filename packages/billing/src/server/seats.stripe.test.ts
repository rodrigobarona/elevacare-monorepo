import { beforeEach, describe, expect, it, vi } from "vitest"

/** Everything that happened, in order: Stripe calls and database work. */
const { fake, order, audit } = vi.hoisted(() => {
  const order: string[] = []
  return {
    order,
    audit: { open: 0, events: [] as Record<string, unknown>[] },
    fake: {
      subscriptions: { retrieve: vi.fn() },
      prices: { list: vi.fn() },
      subscriptionItems: { create: vi.fn(), update: vi.fn() },
    },
  }
})

vi.mock("./client", () => ({ stripe: () => fake }))
vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (
      tx: unknown,
      ctx: { emit: (event: Record<string, unknown>) => void }
    ) => Promise<unknown>
  ) => {
    audit.open += 1
    order.push("transaction opens")
    const tx = {
      update: () => ({
        set: (values: { seatItemId?: string }) => ({
          where: async () => {
            order.push(`mirror stores ${values.seatItemId}`)
          },
        }),
      }),
    }
    try {
      return await fn(tx, { emit: (event) => void audit.events.push(event) })
    } finally {
      audit.open -= 1
      order.push("transaction closes")
    }
  },
}))
vi.mock("@eleva/db", () => ({
  countBillableSeats: vi.fn(),
  db: vi.fn(),
  main: {
    billingSubscriptions: {
      orgId: "org_id",
      stripeSubscriptionId: "stripe_subscription_id",
      seatItemId: "seat_item_id",
    },
  },
  withOrgContext: vi.fn(),
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("@eleva/db/schema/auth", () => ({ organization: {} }))
vi.stubEnv("KV_REST_API_URL", "")
vi.stubEnv("KV_REST_API_TOKEN", "")

import { countBillableSeats, db, withOrgContext } from "@eleva/db"
import { syncSeatQuantity, syncSeatQuantityAudited } from "./seats"

const SUB = "sub_current"
const planItem = {
  id: "si_plan",
  price: { product: "prod_starter", metadata: { eleva_price_type: "base" } },
}
const seatItem = {
  id: "si_seat",
  price: {
    product: "prod_starter",
    metadata: { eleva_price_type: "per_seat" },
  },
}

/** Every Stripe call must find the database idle. */
function stripeCall<T>(name: string, answer: T) {
  return vi.fn(async () => {
    expect(audit.open, `${name} inside a transaction`).toBe(0)
    order.push(name)
    return answer
  })
}

function clinicWithoutSeatItem(seats: number) {
  return {
    getOrgType: async () => "team",
    getCurrentSubscription: async () => ({
      stripeSubscriptionId: SUB,
      seatItemId: null,
    }),
    countSeats: async () => seats,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  order.length = 0
  audit.events.length = 0
  fake.prices.list = stripeCall("prices.list", {
    data: [
      { id: "price_plan", metadata: { eleva_price_type: "base" } },
      { id: "price_seat", metadata: { eleva_price_type: "per_seat" } },
    ],
  })
  fake.subscriptionItems.create = stripeCall("items.create", { id: "si_new" })
  fake.subscriptionItems.update = stripeCall("items.update", {})
})

describe("the seat item in Stripe", () => {
  it("is created once, on the subscription's own plan, at the count", async () => {
    fake.subscriptions.retrieve = stripeCall("subscriptions.retrieve", {
      status: "active",
      items: { data: [planItem] },
    })
    const result = await syncSeatQuantity("org_1", clinicWithoutSeatItem(2))
    expect(fake.prices.list).toHaveBeenCalledWith(
      expect.objectContaining({ product: "prod_starter" })
    )
    expect(fake.subscriptionItems.create).toHaveBeenCalledWith(
      {
        subscription: SUB,
        price: "price_seat",
        quantity: 2,
        proration_behavior: "create_prorations",
      },
      { idempotencyKey: `seat_item_${SUB}_price_seat_2` }
    )
    expect(fake.subscriptionItems.update).not.toHaveBeenCalled()
    expect(result.seatItem).toEqual({
      stripeSubscriptionId: SUB,
      itemId: "si_new",
      created: true,
    })
  })

  it("is not created when Stripe already has one: that one gets the count", async () => {
    fake.subscriptions.retrieve = stripeCall("subscriptions.retrieve", {
      status: "active",
      items: { data: [planItem, seatItem] },
    })
    const result = await syncSeatQuantity("org_1", clinicWithoutSeatItem(3))
    expect(fake.subscriptionItems.create).not.toHaveBeenCalled()
    expect(fake.subscriptionItems.update).toHaveBeenCalledWith("si_seat", {
      quantity: 3,
      proration_behavior: "create_prorations",
    })
    expect(result.seatItem).toMatchObject({ itemId: "si_seat", created: false })
  })

  it.each(["incomplete", "incomplete_expired", "canceled", "unpaid", "paused"])(
    "is neither created nor changed on a subscription that is %s",
    async (status) => {
      fake.subscriptions.retrieve = stripeCall("subscriptions.retrieve", {
        status,
        items: { data: [planItem] },
      })
      await expect(
        syncSeatQuantity("org_1", clinicWithoutSeatItem(2))
      ).resolves.toEqual({ synced: false })
      expect(fake.prices.list).not.toHaveBeenCalled()
      expect(fake.subscriptionItems.create).not.toHaveBeenCalled()
      expect(fake.subscriptionItems.update).not.toHaveBeenCalled()
    }
  )

  it("is not created for a plan that has no seat price", async () => {
    fake.subscriptions.retrieve = stripeCall("subscriptions.retrieve", {
      status: "active",
      items: { data: [planItem] },
    })
    fake.prices.list = stripeCall("prices.list", {
      data: [{ id: "price_plan", metadata: { eleva_price_type: "base" } }],
    })
    await expect(
      syncSeatQuantity("org_1", clinicWithoutSeatItem(2))
    ).resolves.toEqual({ synced: false })
    expect(fake.subscriptionItems.create).not.toHaveBeenCalled()
  })
})

describe("the sync and its record", () => {
  /** The defaults read Postgres; here they read these two rows. */
  function clinicInMirror(seats: number) {
    vi.mocked(db).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ type: "team" }] }),
        }),
      }),
    } as never)
    vi.mocked(withOrgContext).mockImplementation((async () => ({
      stripeSubscriptionId: SUB,
      seatItemId: null,
    })) as never)
    vi.mocked(countBillableSeats).mockResolvedValue(seats)
  }

  it("calls Stripe first, and opens the transaction only to record the answer", async () => {
    clinicInMirror(1)
    fake.subscriptions.retrieve = stripeCall("subscriptions.retrieve", {
      status: "active",
      items: { data: [planItem] },
    })
    await syncSeatQuantityAudited("org_1", "user_1")
    expect(order).toEqual([
      "subscriptions.retrieve",
      "prices.list",
      "items.create",
      "transaction opens",
      "mirror stores si_new",
      "transaction closes",
    ])
    expect(audit.events).toEqual([
      {
        entity: "billing_subscription",
        action: "synced",
        entityId: "org_1",
        payload: {
          synced: true,
          quantity: 1,
          seatItemId: "si_new",
          seatItemCreated: true,
        },
      },
    ])
  })

  it("records a failure after Stripe failed, and throws so the mark stays", async () => {
    clinicInMirror(1)
    fake.subscriptions.retrieve = vi.fn(async () => {
      expect(audit.open).toBe(0)
      throw new Error("Stripe is unreachable")
    })
    await expect(syncSeatQuantityAudited("org_1", null)).rejects.toThrow(
      "Stripe is unreachable"
    )
    expect(fake.subscriptions.retrieve).toHaveBeenCalledTimes(3)
    expect(audit.events).toEqual([
      expect.objectContaining({
        entity: "billing_subscription",
        action: "failed",
        payload: { retry: "seat_sync", error: "Stripe is unreachable" },
      }),
    ])
  })
})
