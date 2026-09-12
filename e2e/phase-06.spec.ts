import { expect, test } from "@playwright/test"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"
const PAYMENT_ID = "00000000-0000-4000-8000-000000000101"
const PAYOUT_ID = "00000000-0000-4000-8000-000000000102"

const PHASE_06_OPENAPI_PATHS = [
  "/payments/{bookingPaymentId}/refund",
  "/payouts",
  "/payouts/{id}/approve",
  "/payouts/{id}/hold",
  "/payouts/{id}/release",
  "/me/finance/summary",
  "/webhooks/stripe",
  "/webhooks/stripe/connect",
] as const

const UNAUTHENTICATED_401 = [
  { method: "GET", path: "/payouts" },
  { method: "GET", path: "/me/finance/summary" },
  { method: "POST", path: `/payments/${PAYMENT_ID}/refund` },
  { method: "POST", path: `/payouts/${PAYOUT_ID}/approve` },
  { method: "POST", path: `/payouts/${PAYOUT_ID}/hold` },
  { method: "POST", path: `/payouts/${PAYOUT_ID}/release` },
] as const

const WORKFLOW_ROUTES = [
  "/workflows/process-expert-transfers",
  "/workflows/process-pending-payouts",
  "/workflows/check-upcoming-payouts",
] as const

test.describe("phase 06 payout and refund surfaces", () => {
  test("OpenAPI documents payout, refund, finance, and both Stripe endpoints", async ({
    request,
  }) => {
    const response = await request.get(`${apiUrl}/openapi.json`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      paths?: Record<string, Record<string, { operationId?: string }>>
    }
    expect(body.paths && typeof body.paths === "object").toBe(true)
    for (const path of PHASE_06_OPENAPI_PATHS) {
      expect(body.paths?.[path], path).toBeTruthy()
    }
    expect(
      body.paths?.["/payments/{bookingPaymentId}/refund"]?.post
    ).toBeTruthy()
    expect(body.paths?.["/payouts"]?.get).toBeTruthy()
    expect(body.paths?.["/payouts/{id}/approve"]?.post).toBeTruthy()
    expect(body.paths?.["/payouts/{id}/hold"]?.post).toBeTruthy()
    expect(body.paths?.["/payouts/{id}/release"]?.post).toBeTruthy()
    expect(body.paths?.["/me/finance/summary"]?.get).toBeTruthy()
    expect(body.paths?.["/webhooks/stripe"]?.post).toBeTruthy()
    expect(body.paths?.["/webhooks/stripe/connect"]?.post).toBeTruthy()
  })

  test("payout and refund mutations reject anonymous callers", async ({
    request,
  }) => {
    for (const route of UNAUTHENTICATED_401) {
      const response = await request.fetch(`${apiUrl}${route.path}`, {
        method: route.method,
        headers: { "Content-Type": "application/json" },
        data: route.method === "POST" ? { reason: "e2e-anonymous" } : undefined,
      })
      expect(response.status(), `${route.method} ${route.path}`).toBe(401)
      const body = (await response.json()) as { error?: string }
      expect(body.error, `${route.method} ${route.path}`).toBe("unauthorized")
    }
  })

  test("unsigned Stripe webhooks never process an event", async ({
    request,
  }) => {
    for (const path of [
      "/webhooks/stripe",
      "/webhooks/stripe/connect",
    ] as const) {
      const eventId = `evt_e2e_unsigned_${path.replaceAll("/", "_")}_${Date.now()}`
      const response = await request.post(`${apiUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        data: { id: eventId, type: "payment_intent.succeeded" },
      })
      expect([400, 500], path).toContain(response.status())
      const body = (await response.json()) as {
        error?: string
        received?: boolean
        status?: string
        eventType?: string
      }
      expect(
        [
          "missing_signature",
          "invalid_signature",
          "webhook_not_configured",
          "stripe_init_failed",
        ],
        path
      ).toContain(body.error)
      // Fail-closed responses never reach processStripeEvent (persists
      // stripe_webhook_events + dispatches). Proven in handle-webhook.test.ts.
      expect(body.received, path).not.toBe(true)
      expect(body.status, path).not.toBe("processed")
      expect(body.status, path).not.toBe("duplicate")
      expect(body.eventType, path).toBeUndefined()
    }
  })

  test("payout workflows reject callers without the drain secret", async ({
    request,
  }) => {
    for (const path of WORKFLOW_ROUTES) {
      const response = await request.post(`${apiUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        data: {},
      })
      expect([401, 500], path).toContain(response.status())
      const body = (await response.json()) as { error?: string; ok?: boolean }
      expect(body.ok, path).not.toBe(true)
      expect(["unauthorized", "server_misconfiguration"], path).toContain(
        body.error
      )
    }
  })
})
