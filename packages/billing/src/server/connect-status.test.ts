import { describe, expect, it } from "vitest"
import {
  isConnectPublishReady,
  requireUpdatedBillingCustomer,
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
