import { beforeEach, describe, expect, it, vi } from "vitest"

const assertConnectReadyForPayments = vi.fn()

vi.mock("@eleva/billing/server", async () => {
  class ConnectIncompleteError extends Error {
    readonly code = "CONNECT_INCOMPLETE"
    constructor() {
      super("Complete Payments onboarding before publishing a paid service")
      this.name = "ConnectIncompleteError"
    }
  }
  return { assertConnectReadyForPayments, ConnectIncompleteError }
})
vi.mock("@eleva/flags", () => ({ getFlag: vi.fn(async () => false) }))

const {
  assertPaymentsReadyForPaidChange,
  connectIncompleteResponse,
  modeBecomesPaid,
  servicePriceBecomesPaid,
} = await import("./paid-offer-guard")
const { ConnectIncompleteError } = await import("@eleva/billing/server")

const tx = {} as Parameters<typeof assertPaymentsReadyForPaidChange>[0]

describe("servicePriceBecomesPaid", () => {
  it("flags a free service that gets a price", () => {
    expect(
      servicePriceBecomesPaid({ currentPriceAmount: 0, nextPriceAmount: 4000 })
    ).toBe(true)
  })

  it("ignores free edits, untouched prices and already-paid services", () => {
    expect(
      servicePriceBecomesPaid({ currentPriceAmount: 0, nextPriceAmount: 0 })
    ).toBe(false)
    expect(
      servicePriceBecomesPaid({
        currentPriceAmount: 0,
        nextPriceAmount: undefined,
      })
    ).toBe(false)
    expect(
      servicePriceBecomesPaid({
        currentPriceAmount: 6000,
        nextPriceAmount: 7000,
      })
    ).toBe(false)
  })
})

describe("modeBecomesPaid", () => {
  it("flags a new active paid mode", () => {
    expect(
      modeBecomesPaid({ current: null, nextActive: true, nextPriceCents: 4000 })
    ).toBe(true)
  })

  it("flags reactivating a paid mode", () => {
    expect(
      modeBecomesPaid({
        current: { active: false, priceCents: 4000 },
        nextActive: true,
        nextPriceCents: 4000,
      })
    ).toBe(true)
  })

  it("flags giving an active free mode a price", () => {
    expect(
      modeBecomesPaid({
        current: { active: true, priceCents: null },
        nextActive: true,
        nextPriceCents: 2500,
      })
    ).toBe(true)
  })

  it("ignores free modes, inactive paid modes and already-paid modes", () => {
    expect(
      modeBecomesPaid({ current: null, nextActive: true, nextPriceCents: null })
    ).toBe(false)
    expect(
      modeBecomesPaid({
        current: null,
        nextActive: false,
        nextPriceCents: 4000,
      })
    ).toBe(false)
    expect(
      modeBecomesPaid({
        current: { active: true, priceCents: 4000 },
        nextActive: true,
        nextPriceCents: 5000,
      })
    ).toBe(false)
  })
})

describe("assertPaymentsReadyForPaidChange", () => {
  beforeEach(() => assertConnectReadyForPayments.mockReset())

  it("skips the Payments check for drafts and free changes", async () => {
    await assertPaymentsReadyForPaidChange(tx, {
      orgId: "org",
      published: false,
      takesPayment: true,
      stripeIdentityStatus: null,
    })
    await assertPaymentsReadyForPaidChange(tx, {
      orgId: "org",
      published: true,
      takesPayment: false,
      stripeIdentityStatus: null,
    })
    expect(assertConnectReadyForPayments).not.toHaveBeenCalled()
  })

  it("rejects a published service turning paid without Payments setup", async () => {
    assertConnectReadyForPayments.mockRejectedValueOnce(
      new ConnectIncompleteError()
    )
    await expect(
      assertPaymentsReadyForPaidChange(tx, {
        orgId: "org",
        published: true,
        takesPayment: true,
        stripeIdentityStatus: null,
      })
    ).rejects.toBeInstanceOf(ConnectIncompleteError)
    expect(assertConnectReadyForPayments).toHaveBeenCalledWith(tx, "org", {
      identityRequired: false,
      fallbackIdentityStatus: null,
    })
  })
})

describe("connectIncompleteResponse", () => {
  it("answers 409 CONNECT_INCOMPLETE for the Payments error only", async () => {
    const res = connectIncompleteResponse(new ConnectIncompleteError(), {})
    expect(res?.status).toBe(409)
    expect(await res?.json()).toMatchObject({ code: "CONNECT_INCOMPLETE" })
    expect(connectIncompleteResponse(new Error("other"), {})).toBeNull()
  })
})
