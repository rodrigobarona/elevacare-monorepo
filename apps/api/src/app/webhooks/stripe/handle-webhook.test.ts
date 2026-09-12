import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@eleva/billing/server", () => ({
  processStripeEvent: vi.fn(),
  stripe: vi.fn(),
}))

vi.mock("@eleva/observability", () => ({
  captureException: vi.fn(),
}))

import { processStripeEvent, stripe } from "@eleva/billing/server"
import { handleStripeWebhook } from "./handle-webhook"

const processStripeEventMock = vi.mocked(processStripeEvent)
const stripeMock = vi.mocked(stripe)
const constructEventAsync = vi.fn()

function unsignedRequest(eventId: string): Request {
  return new Request("http://127.0.0.1:3002/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: eventId,
      type: "payment_intent.succeeded",
    }),
  })
}

describe("handleStripeWebhook fail-closed", () => {
  beforeEach(() => {
    processStripeEventMock.mockReset()
    constructEventAsync.mockReset()
    stripeMock.mockReset()
    stripeMock.mockReturnValue({
      webhooks: { constructEventAsync },
    } as unknown as ReturnType<typeof stripe>)
  })

  it("does not dispatch when the signing secret is missing", async () => {
    const response = await handleStripeWebhook(
      unsignedRequest("evt_no_secret"),
      {
        secret: undefined,
        source: "platform",
        secretName: "STRIPE_WEBHOOK_SECRET",
      }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "webhook_not_configured" })
    expect(stripeMock).not.toHaveBeenCalled()
    expect(processStripeEventMock).not.toHaveBeenCalled()
  })

  it("does not dispatch an unsigned body when the secret is configured", async () => {
    const response = await handleStripeWebhook(
      unsignedRequest("evt_unsigned_platform"),
      {
        secret: "whsec_test",
        source: "platform",
        secretName: "STRIPE_WEBHOOK_SECRET",
      }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "missing_signature" })
    expect(constructEventAsync).not.toHaveBeenCalled()
    expect(processStripeEventMock).not.toHaveBeenCalled()
  })

  it("does not dispatch Connect events with a bogus signature", async () => {
    const err = new Error("invalid signature")
    err.name = "StripeSignatureVerificationError"
    constructEventAsync.mockRejectedValueOnce(err)

    const response = await handleStripeWebhook(
      new Request("http://127.0.0.1:3002/webhooks/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "t=1,v1=deadbeef",
        },
        body: JSON.stringify({
          id: "evt_bogus_connect",
          type: "payout.paid",
        }),
      }),
      {
        secret: "whsec_connect",
        source: "connect",
        secretName: "STRIPE_CONNECT_WEBHOOK_SECRET",
      }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid_signature" })
    expect(processStripeEventMock).not.toHaveBeenCalled()
  })
})
