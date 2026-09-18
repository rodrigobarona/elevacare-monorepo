import { describe, expect, it } from "vitest"
import { DEFAULT_SUBSCRIBERS, DOMAIN_EVENT_TYPES } from "./domain-events"

describe("closed-gate invoice domain events", () => {
  it("exposes blocked/skipped/pending and never issued or failed", () => {
    expect(DOMAIN_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "booking.guest_activation_required",
        "invoice.blocked",
        "invoice.skipped",
        "invoice.pending",
      ])
    )
    expect(DOMAIN_EVENT_TYPES).not.toContain("invoice.issued")
    expect(DOMAIN_EVENT_TYPES).not.toContain("invoice.failed")
    expect(DOMAIN_EVENT_TYPES).not.toContain("invoice.credited")
    expect(DEFAULT_SUBSCRIBERS["invoice.blocked"]).toEqual(["logger"])
    expect(DEFAULT_SUBSCRIBERS["invoice.skipped"]).toEqual(["logger"])
    expect(DEFAULT_SUBSCRIBERS["invoice.pending"]).toEqual(["logger"])
  })
})
