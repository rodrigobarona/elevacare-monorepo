import { describe, expect, it } from "vitest"
import type Stripe from "stripe"
import {
  foreignEnvironmentReason,
  stripeEnvironmentTag,
} from "./stripe-environment"

function event(metadata?: Record<string, string>) {
  return { data: { object: { metadata } } } as unknown as Pick<
    Stripe.Event,
    "data"
  >
}

describe("stripeEnvironmentTag", () => {
  it("uses the Vercel environment and falls back to development", () => {
    expect(stripeEnvironmentTag("production")).toBe("production")
    expect(stripeEnvironmentTag(undefined)).toBe("development")
  })
})

describe("foreignEnvironmentReason", () => {
  it("ignores events created by another environment", () => {
    expect(
      foreignEnvironmentReason(
        event({ eleva_env: "development" }),
        "production"
      )
    ).toBe("foreign_environment:development")
  })

  it("processes events from this environment", () => {
    expect(
      foreignEnvironmentReason(event({ eleva_env: "production" }), "production")
    ).toBeNull()
  })

  it("processes untagged events (objects created before tagging)", () => {
    expect(foreignEnvironmentReason(event({}), "production")).toBeNull()
    expect(foreignEnvironmentReason(event(), "production")).toBeNull()
  })
})
