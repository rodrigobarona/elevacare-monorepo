import { describe, expect, it, vi } from "vitest"
import type { WebhookEventPayload } from "resend"
import { handleResendWebhook } from "./handle-resend-webhook"
import type { DeliveryRow } from "./claim-delivery"

const DELIVERY_ID = "00000000-0000-4000-8000-000000000001"
const EMAIL_ID = "re_abc123"
const ORG_ID = "00000000-0000-4000-8000-000000000010"

function baseRow(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: DELIVERY_ID,
    orgId: ORG_ID,
    idempotencyKey: "booking:1:confirmed",
    kind: "booking.confirmed",
    userId: "00000000-0000-4000-8000-000000000020",
    recipientEmail: null,
    channel: "email",
    status: "sent",
    providerId: EMAIL_ID,
    leaseOwner: "run-1",
    claimedAt: new Date("2026-09-22T10:00:00.000Z"),
    firstAttemptAt: new Date("2026-09-22T10:00:00.000Z"),
    smsBodyHash: null,
    error: null,
    ...overrides,
  }
}

function signedRequest(body: string): Request {
  return new Request("https://api.eleva.care/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": "msg_1",
      "svix-timestamp": "1710000000",
      "svix-signature": "v1,test",
    },
    body,
  })
}

describe("handleResendWebhook", () => {
  const previousSecret = process.env.RESEND_WEBHOOK_SECRET

  function restoreEnv() {
    if (previousSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET
    else process.env.RESEND_WEBHOOK_SECRET = previousSecret
  }

  it("rejects missing signature headers", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    try {
      const result = await handleResendWebhook(
        new Request("https://api.eleva.care/webhooks/resend", {
          method: "POST",
          body: "{}",
        }),
        { verify: () => ({ type: "email.delivered" }) as WebhookEventPayload }
      )
      expect(result.status).toBe(401)
      expect(result.body.error).toMatch(/missing signature/)
    } finally {
      restoreEnv()
    }
  })

  it("rejects when RESEND_WEBHOOK_SECRET is missing", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () => ({ type: "email.delivered" }) as WebhookEventPayload,
      })
      expect(result.status).toBe(500)
      expect(result.body.error).toMatch(/RESEND_WEBHOOK_SECRET/)
    } finally {
      restoreEnv()
    }
  })

  it("rejects invalid signatures", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () => {
          throw new Error("bad sig")
        },
      })
      expect(result.status).toBe(401)
      expect(result.body.error).toMatch(/invalid signature/)
    } finally {
      restoreEnv()
    }
  })

  it("ignores unhandled event types", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.opened",
            created_at: "2026-09-22T10:00:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: EMAIL_ID,
              from: "a@eleva.care",
              to: ["member@example.com"],
              subject: "hi",
            },
          }) as WebhookEventPayload,
      })
      expect(result).toEqual({
        status: 200,
        body: { ok: true, handled: false },
      })
    } finally {
      restoreEnv()
    }
  })

  it("marks delivered by deliveryId tag", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    const complete = vi.fn().mockResolvedValue(true)
    const completeInTx = vi.fn().mockResolvedValue(true)
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.delivered",
            created_at: "2026-09-22T10:01:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: EMAIL_ID,
              from: "a@eleva.care",
              to: ["member@example.com"],
              subject: "hi",
              tags: { deliveryId: DELIVERY_ID },
            },
          }) as WebhookEventPayload,
        loadById: async () => baseRow({ orgId: null }),
        complete,
        completeInTx,
        now: () => new Date("2026-09-22T10:01:00.000Z"),
      })
      expect(result.body).toEqual({ ok: true, handled: true })
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: DELIVERY_ID,
          providerId: EMAIL_ID,
          status: "delivered",
        })
      )
      expect(completeInTx).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it("suppresses on permanent bounce and adopts by provider id", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    const complete = vi.fn().mockResolvedValue(true)
    const suppress = vi.fn().mockResolvedValue({ id: "sup-1", created: true })
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.bounced",
            created_at: "2026-09-22T10:01:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: EMAIL_ID,
              from: "a@eleva.care",
              to: ["bounced@example.com"],
              subject: "hi",
              bounce: {
                message: "550 user unknown",
                type: "Permanent",
                subType: "General",
              },
            },
          }) as WebhookEventPayload,
        loadById: async () => null,
        loadByProviderId: async () =>
          baseRow({
            orgId: null,
            recipientEmail: "bounced@example.com",
            userId: null,
          }),
        complete,
        suppress,
        now: () => new Date("2026-09-22T10:01:00.000Z"),
      })
      expect(result.body).toEqual({ ok: true, handled: true })
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "bounced",
          error: "550 user unknown",
        })
      )
      expect(suppress).toHaveBeenCalledWith({
        email: "bounced@example.com",
        reason: "hard_bounce",
      })
    } finally {
      restoreEnv()
    }
  })

  it("does not suppress transient bounces", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    const complete = vi.fn().mockResolvedValue(true)
    const suppress = vi.fn()
    try {
      await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.bounced",
            created_at: "2026-09-22T10:01:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: EMAIL_ID,
              from: "a@eleva.care",
              to: ["soft@example.com"],
              subject: "hi",
              bounce: {
                message: "mailbox full",
                type: "Transient",
                subType: "MailboxFull",
              },
            },
          }) as WebhookEventPayload,
        loadByProviderId: async () => baseRow({ orgId: null }),
        complete,
        suppress,
      })
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "bounced" })
      )
      expect(suppress).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it("suppresses complaints", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    const complete = vi.fn().mockResolvedValue(true)
    const suppress = vi.fn().mockResolvedValue({
      id: "sup-2",
      created: true,
      reason: "complaint",
    })
    try {
      await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.complained",
            created_at: "2026-09-22T10:01:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: EMAIL_ID,
              from: "a@eleva.care",
              to: ["spam@example.com"],
              subject: "hi",
            },
          }) as WebhookEventPayload,
        loadByProviderId: async () => baseRow({ orgId: null }),
        complete,
        suppress,
      })
      expect(suppress).toHaveBeenCalledWith({
        email: "spam@example.com",
        reason: "complaint",
      })
    } finally {
      restoreEnv()
    }
  })

  it("ignores a tagged row whose provider_id belongs to a newer send", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
    const complete = vi.fn()
    try {
      const result = await handleResendWebhook(signedRequest("{}"), {
        verify: () =>
          ({
            type: "email.delivered",
            created_at: "2026-09-22T10:01:00.000Z",
            data: {
              created_at: "2026-09-22T10:00:00.000Z",
              email_id: "re_old",
              from: "a@eleva.care",
              to: ["member@example.com"],
              subject: "hi",
              tags: { deliveryId: DELIVERY_ID },
            },
          }) as WebhookEventPayload,
        loadById: async () => baseRow({ orgId: null, providerId: "re_new" }),
        loadByProviderId: async () => null,
        complete,
      })
      expect(result.body).toEqual({ ok: true, handled: false })
      expect(complete).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })
})
