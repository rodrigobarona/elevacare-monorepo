import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  WEBHOOK_MAX_SKEW_MS,
  isDailyWebhookHandshake,
  parseDailyWebhookEvent,
  verifyDailyWebhook,
} from "./webhooks"

const SECRET = Buffer.from("webhook-secret-bytes").toString("base64")

function sign(timestamp: string, body: string): string {
  return createHmac("sha256", Buffer.from(SECRET, "base64"))
    .update(`${timestamp}.${body}`)
    .digest("base64")
}

describe("verifyDailyWebhook", () => {
  it("accepts a matching HMAC of timestamp.body", () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const body = '{"type":"meeting.started"}'
    expect(
      verifyDailyWebhook({
        timestamp,
        signature: sign(timestamp, body),
        body,
        secret: SECRET,
      })
    ).toBe(true)
  })

  it("rejects a tampered body", () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    expect(
      verifyDailyWebhook({
        timestamp,
        signature: sign(timestamp, '{"type":"meeting.started"}'),
        body: '{"type":"meeting.ended"}',
        secret: SECRET,
      })
    ).toBe(false)
  })

  it("rejects a replayed timestamp outside the skew window", () => {
    const timestamp = String(
      Math.floor((Date.now() - WEBHOOK_MAX_SKEW_MS - 1000) / 1000)
    )
    const body = '{"type":"meeting.started"}'
    expect(
      verifyDailyWebhook({
        timestamp,
        signature: sign(timestamp, body),
        body,
        secret: SECRET,
      })
    ).toBe(false)
  })

  it("rejects missing headers", () => {
    expect(
      verifyDailyWebhook({
        timestamp: null,
        signature: "x",
        body: "{}",
        secret: SECRET,
      })
    ).toBe(false)
  })
})

describe("isDailyWebhookHandshake", () => {
  it("accepts Daily's create-webhook probe body", () => {
    expect(isDailyWebhookHandshake('{"test":"test"}')).toBe(true)
  })

  it("rejects a lifecycle event", () => {
    expect(isDailyWebhookHandshake('{"type":"meeting.started"}')).toBe(false)
  })
})

describe("parseDailyWebhookEvent", () => {
  it("accepts the Phase 09 event types", () => {
    expect(parseDailyWebhookEvent({ type: "meeting.started" }).type).toBe(
      "meeting.started"
    )
    expect(parseDailyWebhookEvent({ type: "participant.joined" }).type).toBe(
      "participant.joined"
    )
  })

  it("rejects unknown types so we do not process recording events", () => {
    expect(() =>
      parseDailyWebhookEvent({ type: "recording.ready-to-download" })
    ).toThrow()
  })
})
