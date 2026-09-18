import { describe, expect, it, vi } from "vitest"

vi.mock("./guest-activation", () => ({
  activateGuestBooking: vi.fn(),
}))

import { defaultDomainEventSubscribers } from "./index"

describe("defaultDomainEventSubscribers", () => {
  it("does not register a logging-only delivery subscriber", () => {
    expect(Object.keys(defaultDomainEventSubscribers())).toEqual([
      "guest-activation",
    ])
  })
})
