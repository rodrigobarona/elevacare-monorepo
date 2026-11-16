import { describe, expect, it } from "vitest"
import type Stripe from "stripe"
import {
  isConnectPublishReady,
  isMissingBillingCustomerError,
  offerTakesPayment,
  requireUpdatedBillingCustomer,
  snapshotFromAccount,
} from "./connect-status"

describe("isConnectPublishReady", () => {
  const ready = {
    detailsSubmitted: true,
    payoutsEnabled: true,
    transfersStatus: "active",
    identityRequired: false,
    identityStatus: null,
  } as const

  it("requires details, payouts, and active transfers", () => {
    expect(isConnectPublishReady(ready)).toBe(true)
  })

  it("rejects when details_submitted is false", () => {
    expect(isConnectPublishReady({ ...ready, detailsSubmitted: false })).toBe(
      false
    )
  })

  it("rejects when payouts_enabled is false", () => {
    expect(isConnectPublishReady({ ...ready, payoutsEnabled: false })).toBe(
      false
    )
  })

  it("rejects inactive transfers", () => {
    expect(
      isConnectPublishReady({ ...ready, transfersStatus: "pending" })
    ).toBe(false)
  })

  it("rejects missing transfers capability", () => {
    expect(
      isConnectPublishReady({ ...ready, transfersStatus: undefined })
    ).toBe(false)
  })

  it("requires verified identity when the flag is on", () => {
    expect(
      isConnectPublishReady({
        detailsSubmitted: true,
        payoutsEnabled: true,
        transfersStatus: "active",
        identityRequired: true,
        identityStatus: "pending",
      })
    ).toBe(false)
    expect(
      isConnectPublishReady({
        detailsSubmitted: true,
        payoutsEnabled: true,
        transfersStatus: "active",
        identityRequired: true,
        identityStatus: "verified",
      })
    ).toBe(true)
  })
})

describe("requireUpdatedBillingCustomer", () => {
  it("throws when the UPDATE matched no billing_customers row", () => {
    expect(() => requireUpdatedBillingCustomer([], "org_1")).toThrow(
      /billing_customers row missing/
    )
  })

  it("passes when a row was returned", () => {
    expect(() =>
      requireUpdatedBillingCustomer([{ orgId: "org_1" }], "org_1")
    ).not.toThrow()
  })
})

describe("isMissingBillingCustomerError", () => {
  it("matches the missing-row error from requireUpdatedBillingCustomer", () => {
    try {
      requireUpdatedBillingCustomer([], "org_1")
    } catch (err) {
      expect(isMissingBillingCustomerError(err)).toBe(true)
      return
    }
    throw new Error("expected throw")
  })

  it("rejects unrelated errors", () => {
    expect(isMissingBillingCustomerError(new Error("db down"))).toBe(false)
  })
})

describe("snapshotFromAccount", () => {
  it("fail-closes omitted Stripe account fields", () => {
    const snapshot = snapshotFromAccount({ id: "acct_1" } as Stripe.Account)
    expect(snapshot.stripeConnectAccountId).toBe("acct_1")
    expect(snapshot.payoutsEnabled).toBe(false)
    expect(snapshot.detailsSubmitted).toBe(false)
    expect(snapshot.requirementsCurrentlyDue).toEqual([])
    expect(snapshot.connectCapabilities.transfers).toBeUndefined()
  })
})

describe("offerTakesPayment", () => {
  it("treats a zero-price service with free modes as free", () => {
    expect(
      offerTakesPayment({
        priceAmount: 0,
        modes: [
          { active: true, priceCents: null },
          { active: true, priceCents: 0 },
        ],
      })
    ).toBe(false)
  })

  it("is paid when the service has a price", () => {
    expect(offerTakesPayment({ priceAmount: 6000, modes: [] })).toBe(true)
  })

  it("is paid when an active mode has its own price", () => {
    expect(
      offerTakesPayment({
        priceAmount: 0,
        modes: [{ active: true, priceCents: 4000 }],
      })
    ).toBe(true)
  })

  it("ignores the price on an inactive mode", () => {
    expect(
      offerTakesPayment({
        priceAmount: 0,
        modes: [{ active: false, priceCents: 4000 }],
      })
    ).toBe(false)
  })
})
