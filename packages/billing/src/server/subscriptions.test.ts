import { beforeEach, describe, expect, it, vi } from "vitest"

const { fake, emitted } = vi.hoisted(() => ({
  fake: {
    products: { search: vi.fn() },
    prices: { list: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
  emitted: [] as unknown[],
}))

vi.mock("./client", () => ({ stripe: () => fake }))
vi.mock("@eleva/db", () => ({
  countBillableSeats: vi.fn(),
  main: {},
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: (event: unknown) => void }) => unknown
  ) => fn({}, { emit: (event) => void emitted.push(event) }),
}))
import { countBillableSeats } from "@eleva/db"
import {
  createOrgSubscription,
  createSubscriptionCheckoutSession,
  swapSubscriptionTier,
} from "./subscriptions"

/** The catalogue as `seed-products.ts` makes it: one product, two prices. */
function seedCatalogue() {
  fake.products.search.mockImplementation(
    async ({ query }: { query: string }) => ({
      data: [
        { id: query.includes("clinic_growth") ? "prod_growth" : "prod_x" },
      ],
    })
  )
  fake.prices.list.mockImplementation(
    async ({ product }: { product: string }) => ({
      data:
        product === "prod_growth"
          ? [
              { id: "price_growth", metadata: { eleva_price_type: "base" } },
              {
                id: "price_growth_seat",
                metadata: { eleva_price_type: "per_seat" },
              },
            ]
          : [
              { id: "price_plan", metadata: { eleva_price_type: "base" } },
              { id: "price_seat", metadata: { eleva_price_type: "per_seat" } },
            ],
    })
  )
}

function seedPlanWithoutSeats() {
  fake.products.search.mockResolvedValue({ data: [{ id: "prod_top" }] })
  fake.prices.list.mockResolvedValue({
    data: [{ id: "price_top", metadata: { eleva_price_type: "base" } }],
  })
}

/** What Eleva counts for the clinic, as the database would answer. */
const seats = (count: number) =>
  void vi.mocked(countBillableSeats).mockResolvedValue(count)

beforeEach(() => {
  vi.clearAllMocks()
  emitted.length = 0
  fake.subscriptions.create.mockResolvedValue({ id: "sub_1" })
  fake.checkout.sessions.create.mockResolvedValue({
    id: "cs_1",
    client_secret: "cs_secret",
  })
  fake.subscriptions.update.mockResolvedValue({ id: "sub_1" })
})

describe("createOrgSubscription", () => {
  it("gives a new clinic its seat item from the start, at zero", async () => {
    seedCatalogue()
    seats(0)
    await createOrgSubscription({
      customerId: "cus_1",
      tier: "clinic_starter",
      orgId: "org_1",
    })
    expect(fake.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { price: "price_plan", quantity: 1 },
          { price: "price_seat", quantity: 0 },
        ],
      })
    )
  })

  it("starts at the seats the clinic already has", async () => {
    seedCatalogue()
    seats(3)
    await createOrgSubscription({
      customerId: "cus_1",
      tier: "clinic_starter",
      orgId: "org_1",
    })
    expect(fake.subscriptions.create.mock.calls[0]?.[0].items[1]).toEqual({
      price: "price_seat",
      quantity: 3,
    })
  })

  it("adds no seat item to a plan that has no seat price", async () => {
    seedPlanWithoutSeats()
    await createOrgSubscription({
      customerId: "cus_1",
      tier: "expert_top",
      orgId: "org_1",
    })
    expect(fake.subscriptions.create.mock.calls[0]?.[0].items).toEqual([
      { price: "price_top", quantity: 1 },
    ])
    expect(countBillableSeats).not.toHaveBeenCalled()
  })
})

describe("createSubscriptionCheckoutSession", () => {
  const input = {
    customerId: "cus_1",
    tier: "clinic_starter" as const,
    orgId: "org_1",
    actorUserId: "user_1",
    returnUrl: "https://eleva.care/account/billing/return",
  }

  it("bills the plan and the seats Eleva counts, with no quantity for the buyer to change", async () => {
    seedCatalogue()
    seats(3)
    await createSubscriptionCheckoutSession(input)
    const [params] = fake.checkout.sessions.create.mock.calls[0]!
    expect(params.line_items).toEqual([
      { price: "price_plan", quantity: 1 },
      { price: "price_seat", quantity: 3 },
    ])
    expect(JSON.stringify(params)).not.toContain("adjustable_quantity")
  })

  it("leaves the seat line out at zero, which Checkout refuses", async () => {
    seedCatalogue()
    seats(0)
    await createSubscriptionCheckoutSession(input)
    expect(fake.checkout.sessions.create.mock.calls[0]?.[0].line_items).toEqual(
      [{ price: "price_plan", quantity: 1 }]
    )
  })

  it("saves what the buyer types on the customer that already exists", async () => {
    seedCatalogue()
    seats(1)
    await createSubscriptionCheckoutSession(input)
    const [params] = fake.checkout.sessions.create.mock.calls[0]!
    expect(params).toMatchObject({
      mode: "subscription",
      ui_mode: "embedded_page",
      customer: "cus_1",
      return_url: input.returnUrl,
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: { name: "auto", address: "auto" },
      metadata: { eleva_org_id: "org_1", eleva_tier: "clinic_starter" },
      subscription_data: {
        metadata: { eleva_org_id: "org_1", eleva_tier: "clinic_starter" },
      },
    })
    expect(params).not.toHaveProperty("success_url")
    expect(emitted).toHaveLength(1)
  })

  it("is the same request only when it asks for the same things", async () => {
    seedCatalogue()
    const key = async (
      overrides: Partial<typeof input>,
      count: number
    ): Promise<string> => {
      fake.checkout.sessions.create.mockClear()
      seats(count)
      await createSubscriptionCheckoutSession({ ...input, ...overrides })
      return fake.checkout.sessions.create.mock.calls[0]![1].idempotencyKey
    }
    const first = await key({}, 2)
    expect(await key({}, 2)).toBe(first)
    // A seat more, or another place to come back to, is another request.
    expect(await key({}, 3)).not.toBe(first)
    expect(await key({ returnUrl: "https://eleva.care/other" }, 2)).not.toBe(
      first
    )
    expect(first).toMatch(/^checkout_org_1_clinic_starter_user_1_[0-9a-f]{16}$/)
  })
})

describe("swapSubscriptionTier", () => {
  it("moves the seat item to the new plan's price with its quantity said outright", async () => {
    seedCatalogue()
    fake.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: "si_plan", price: { metadata: { eleva_price_type: "base" } } },
          {
            id: "si_seat",
            price: { metadata: { eleva_price_type: "per_seat" } },
          },
        ],
      },
    })
    seats(4)
    await swapSubscriptionTier({
      subscriptionId: "sub_1",
      newTier: "clinic_growth",
      orgId: "org_1",
    })
    // Without a quantity Stripe would reset the moved item to 1.
    expect(fake.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        items: [
          { id: "si_plan", price: "price_growth", quantity: 1 },
          { id: "si_seat", price: "price_growth_seat", quantity: 4 },
        ],
        proration_behavior: "create_prorations",
      })
    )
  })

  it("adds the seat item, at the count, when the old plan had none", async () => {
    seedCatalogue()
    fake.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: "si_plan", price: { metadata: { eleva_price_type: "base" } } },
        ],
      },
    })
    seats(0)
    await swapSubscriptionTier({
      subscriptionId: "sub_1",
      newTier: "clinic_starter",
      orgId: "org_1",
    })
    expect(fake.subscriptions.update.mock.calls[0]?.[1].items[1]).toEqual({
      price: "price_seat",
      quantity: 0,
    })
  })

  it("drops the seat item when the new plan bills no seats", async () => {
    seedPlanWithoutSeats()
    fake.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: "si_plan", price: { metadata: { eleva_price_type: "base" } } },
          {
            id: "si_seat",
            price: { metadata: { eleva_price_type: "per_seat" } },
          },
        ],
      },
    })
    seats(2)
    await swapSubscriptionTier({
      subscriptionId: "sub_1",
      newTier: "expert_top",
      orgId: "org_1",
    })
    expect(fake.subscriptions.update.mock.calls[0]?.[1].items).toEqual([
      { id: "si_plan", price: "price_top", quantity: 1 },
      { id: "si_seat", deleted: true },
    ])
  })
})
