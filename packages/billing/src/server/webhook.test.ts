import type Stripe from "stripe"
import { describe, expect, it } from "vitest"
import {
  mapSubscriptionAction,
  orgIdFromMetadata,
  subscriptionIdFromInvoice,
  subscriptionPeriod,
  tierFromMetadata,
} from "./webhook"

describe("mapSubscriptionAction", () => {
  it("maps customer.subscription.created -> created regardless of status", () => {
    expect(
      mapSubscriptionAction("customer.subscription.created", "active", null)
    ).toBe("created")
    expect(
      mapSubscriptionAction("customer.subscription.created", "trialing", null)
    ).toBe("created")
  })

  it("maps customer.subscription.deleted -> canceled", () => {
    expect(
      mapSubscriptionAction(
        "customer.subscription.deleted",
        "canceled",
        "active"
      )
    ).toBe("canceled")
  })

  it("detects past_due_recovered when status moves past_due -> active", () => {
    expect(
      mapSubscriptionAction(
        "customer.subscription.updated",
        "active",
        "past_due"
      )
    ).toBe("past_due_recovered")
  })

  it("detects reactivated when status moves canceled -> active", () => {
    expect(
      mapSubscriptionAction(
        "customer.subscription.updated",
        "active",
        "canceled"
      )
    ).toBe("reactivated")
  })

  it("falls back to updated for generic transitions", () => {
    expect(
      mapSubscriptionAction(
        "customer.subscription.updated",
        "active",
        "trialing"
      )
    ).toBe("updated")
    expect(
      mapSubscriptionAction(
        "customer.subscription.updated",
        "past_due",
        "active"
      )
    ).toBe("updated")
  })
})

describe("orgIdFromMetadata", () => {
  it("reads valid UUID from eleva_org_id", () => {
    const metadata = {
      eleva_org_id: "12345678-1234-1234-1234-123456789012",
      eleva_tier: "expert_top",
    }
    expect(orgIdFromMetadata(metadata)).toBe(
      "12345678-1234-1234-1234-123456789012"
    )
  })

  it("returns null for missing metadata", () => {
    expect(orgIdFromMetadata(null)).toBeNull()
    expect(orgIdFromMetadata(undefined)).toBeNull()
    expect(orgIdFromMetadata({})).toBeNull()
  })

  it("returns null for short string (not a UUID)", () => {
    expect(orgIdFromMetadata({ eleva_org_id: "short" })).toBeNull()
  })
})

describe("tierFromMetadata", () => {
  it("reads tier value", () => {
    expect(tierFromMetadata({ eleva_tier: "expert_top" })).toBe("expert_top")
    expect(tierFromMetadata({ eleva_tier: "clinic_starter" })).toBe(
      "clinic_starter"
    )
  })

  it("falls back to 'unknown' when missing", () => {
    expect(tierFromMetadata(null)).toBe("unknown")
    expect(tierFromMetadata(undefined)).toBe("unknown")
    expect(tierFromMetadata({})).toBe("unknown")
    expect(tierFromMetadata({ eleva_tier: "" })).toBe("unknown")
  })
})

describe("subscriptionIdFromInvoice", () => {
  it("reads from invoice.parent.subscription_details.subscription as string (current API)", () => {
    const invoice = {
      parent: {
        type: "subscription_details",
        subscription_details: {
          subscription: "sub_123",
          metadata: null,
        },
      },
    } as unknown as Stripe.Invoice
    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_123")
  })

  it("reads from invoice.parent.subscription_details.subscription as expanded object", () => {
    const invoice = {
      parent: {
        type: "subscription_details",
        subscription_details: {
          subscription: { id: "sub_456" } as Stripe.Subscription,
          metadata: null,
        },
      },
    } as unknown as Stripe.Invoice
    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_456")
  })

  it("falls back to legacy invoice.subscription as string (pre-basil API)", () => {
    const invoice = {
      parent: null,
      subscription: "sub_legacy_789",
    } as unknown as Stripe.Invoice
    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_legacy_789")
  })

  it("falls back to legacy invoice.subscription as expanded object", () => {
    const invoice = {
      parent: null,
      subscription: { id: "sub_legacy_obj" },
    } as unknown as Stripe.Invoice
    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_legacy_obj")
  })

  it("returns null when no subscription is referenced", () => {
    const invoice = { parent: null } as unknown as Stripe.Invoice
    expect(subscriptionIdFromInvoice(invoice)).toBeNull()
  })
})

describe("subscriptionPeriod", () => {
  it("reads period from items[0] (basil+)", () => {
    const subscription = {
      items: {
        data: [
          {
            current_period_start: 1735689600, // 2025-01-01
            current_period_end: 1738368000, // 2025-02-01
          },
        ],
      },
    } as unknown as Stripe.Subscription
    const period = subscriptionPeriod(subscription)
    expect(period.start?.toISOString()).toContain("2025-01-01")
    expect(period.end?.toISOString()).toContain("2025-02-01")
  })

  it("falls back to top-level current_period_* fields (pre-basil)", () => {
    const subscription = {
      items: { data: [] },
      current_period_start: 1735689600,
      current_period_end: 1738368000,
    } as unknown as Stripe.Subscription
    const period = subscriptionPeriod(subscription)
    expect(period.start?.toISOString()).toContain("2025-01-01")
    expect(period.end?.toISOString()).toContain("2025-02-01")
  })

  it("returns nulls when no period is set", () => {
    const subscription = {
      items: { data: [] },
    } as unknown as Stripe.Subscription
    const period = subscriptionPeriod(subscription)
    expect(period.start).toBeNull()
    expect(period.end).toBeNull()
  })
})
