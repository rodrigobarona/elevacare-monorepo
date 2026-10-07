import { describe, expect, it } from "vitest"
import { webhookAuditAction } from "./daily-webhook"

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
