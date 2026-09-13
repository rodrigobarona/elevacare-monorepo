import { describe, expect, it } from "vitest"
import { shouldAwaitDomainEventPublish } from "./should-await-domain-event-publish"

describe("shouldAwaitDomainEventPublish", () => {
  it("awaits on loopback and e2e capture, not on deployed production", () => {
    expect(shouldAwaitDomainEventPublish({ E2E_AUTH_CAPTURE: "1" })).toBe(true)
    expect(
      shouldAwaitDomainEventPublish({ API_URL: "http://localhost:3002" })
    ).toBe(true)
    expect(
      shouldAwaitDomainEventPublish({ API_URL: "http://127.0.0.1:3002" })
    ).toBe(true)
    expect(
      shouldAwaitDomainEventPublish({ API_URL: "http://[::1]:3002" })
    ).toBe(true)
    expect(shouldAwaitDomainEventPublish({})).toBe(true)
    expect(
      shouldAwaitDomainEventPublish({
        API_URL: "https://localhost.example.test",
      })
    ).toBe(false)
    expect(
      shouldAwaitDomainEventPublish({
        API_URL: "https://api.example.test/?target=127.0.0.1",
      })
    ).toBe(false)
    expect(
      shouldAwaitDomainEventPublish({
        E2E_AUTH_CAPTURE: "1",
        VERCEL_ENV: "production",
      })
    ).toBe(false)
    expect(
      shouldAwaitDomainEventPublish({
        API_URL: "https://api.eleva.care",
        NODE_ENV: "production",
      })
    ).toBe(false)
  })
})
