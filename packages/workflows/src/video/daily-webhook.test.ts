import { describe, expect, it } from "vitest"
import { webhookAuditAction, webhookEventWriteGate } from "./daily-webhook"

describe("webhookAuditAction", () => {
  it("maps lifecycle events only", () => {
    expect(webhookAuditAction("meeting.started")).toBe("started")
    expect(webhookAuditAction("meeting.ended")).toBe("ended")
  })

  it("does not treat participant history as session.joined", () => {
    expect(webhookAuditAction("participant.joined")).toBeNull()
    expect(webhookAuditAction("participant.left")).toBeNull()
    expect(webhookAuditAction("error")).toBeNull()
  })
})

describe("webhookEventWriteGate", () => {
  it("lets an unprocessed event row proceed into the session write", () => {
    expect(webhookEventWriteGate(null)).toBe("proceed")
    expect(webhookEventWriteGate(undefined)).toBe("proceed")
  })

  it("treats a stamped processed_at as a replay, even on retry", () => {
    expect(webhookEventWriteGate(new Date("2026-10-08T12:00:00.000Z"))).toBe(
      "duplicate"
    )
  })
})
