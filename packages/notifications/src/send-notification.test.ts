import { beforeEach, describe, expect, it } from "vitest"
import {
  LEASE_TTL_MS,
  RESEND_IDEMPOTENCY_WINDOW_MS,
  type ClaimInput,
  type ClaimOutcome,
  type DeliveryRow,
  type DeliveryStatus,
} from "./claim-delivery"
import {
  sendNotification,
  type NotificationChannel,
  type NotificationContent,
  type NotificationRecipient,
  type OrgScopedKind,
  type SendNotificationDeps,
  type SendNotificationInput,
} from "./send-notification"

const ORG_ID = "00000000-0000-4000-8000-000000000001"
const USER_ID = "00000000-0000-4000-8000-000000000002"
const USER_B = "00000000-0000-4000-8000-000000000003"

const content: NotificationContent = {
  title: "Your session with Ana",
  body: "Tomorrow at 10:00",
  subject: "Your session with Ana",
  html: "<p>Your session with Ana</p>",
  href: "/bookings/1",
}

function recipientKey(userId: string | null, email: string | null): string {
  return userId ?? (email ?? "").toLowerCase()
}

function storeKey(input: {
  idempotencyKey: string
  channel: string
  userId: string | null
  recipientEmail: string | null
}): string {
  return `${input.idempotencyKey}:${recipientKey(input.userId, input.recipientEmail)}:${input.channel}`
}

class MemoryStore {
  rows = new Map<string, DeliveryRow>()
  inbox: Array<{ deliveryId: string; userId: string; title: string }> = []
  sendCalls = 0
  listCalls = 0
  accepted = new Map<
    string,
    { id: string; tags: Array<{ name: string; value: string }> }
  >()

  claim(input: ClaimInput): ClaimOutcome {
    const key = storeKey(input)
    const existing = this.rows.get(key)
    if (!existing) {
      const row: DeliveryRow = {
        id: crypto.randomUUID(),
        orgId: input.orgId,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        channel: input.channel,
        status: "queued",
        providerId: null,
        leaseOwner: input.runId,
        claimedAt: input.now,
        firstAttemptAt: null,
        error: null,
      }
      this.rows.set(key, row)
      return { outcome: "claimed", row: { ...row } }
    }
    if (existing.status !== "queued" && existing.status !== "failed") {
      return { outcome: "already_complete", row: { ...existing } }
    }
    const staleBefore = new Date(input.now.getTime() - LEASE_TTL_MS)
    if (existing.claimedAt >= staleBefore) {
      return { outcome: "held", row: { ...existing } }
    }
    existing.leaseOwner = input.runId
    existing.claimedAt = input.now
    existing.status = "queued"
    existing.error = null
    return { outcome: "claimed", row: { ...existing } }
  }

  markFirstAttempt(input: { id: string; runId: string; now: Date }): Date {
    const row = this.byId(input.id)
    if (!row || row.leaseOwner !== input.runId) return input.now
    if (!row.firstAttemptAt) row.firstAttemptAt = input.now
    return row.firstAttemptAt
  }

  complete(input: {
    id: string
    runId: string
    claimedAt: Date
    status: Extract<DeliveryStatus, "sent" | "failed" | "suppressed">
    providerId?: string | null
    error?: string | null
  }): boolean {
    const row = this.byId(input.id)
    if (!row) return false
    if (row.leaseOwner !== input.runId) return false
    if (row.claimedAt.getTime() !== input.claimedAt.getTime()) return false
    row.status = input.status
    row.providerId = input.providerId ?? null
    row.error = input.error ?? null
    return true
  }

  byId(id: string): DeliveryRow | undefined {
    return [...this.rows.values()].find((row) => row.id === id)
  }

  deps(now: { current: Date }): SendNotificationDeps {
    return {
      now: () => now.current,
      loadUser: async (userId) => ({
        userId,
        email: `${userId}@example.com`,
        locale: "pt",
      }),
      listPreferences: async () => [],
      isEmailSuppressed: async () => false,
      claimDelivery: async (input) => this.claim(input),
      markFirstAttempt: async (input) => this.markFirstAttempt(input),
      completeDelivery: async (input) => this.complete(input),
      insertInbox: async (input) => {
        if (this.inbox.some((row) => row.deliveryId === input.deliveryId)) {
          return
        }
        this.inbox.push({
          deliveryId: input.deliveryId,
          userId: input.userId,
          title: input.title,
        })
      },
      sendEmail: async (input) => {
        this.sendCalls += 1
        const providerId = `re_${this.sendCalls}`
        this.accepted.set(input.deliveryId, {
          id: providerId,
          tags: [{ name: "deliveryId", value: input.deliveryId }],
        })
        return { providerId }
      },
      listEmails: async () => {
        this.listCalls += 1
        return [...this.accepted.values()].map((email) => ({
          id: email.id,
          to: [`${USER_ID}@example.com`],
          created_at: now.current,
        }))
      },
      getEmail: async (id) => {
        const match = [...this.accepted.entries()].find(
          ([, email]) => email.id === id
        )
        if (!match) return null
        return { id: match[1].id, tags: match[1].tags }
      },
      recordAudit: async () => undefined,
    }
  }
}

function bookingInput(
  overrides: Partial<{
    kind: OrgScopedKind
    orgId: string
    recipient: NotificationRecipient
    ctx: NotificationContent
    idempotencyKey: string
    channelsOverride: NotificationChannel[]
  }> = {}
): SendNotificationInput {
  return {
    kind: "booking.confirmed",
    orgId: ORG_ID,
    recipient: { userId: USER_ID },
    ctx: content,
    idempotencyKey: "booking:1:confirmed",
    ...overrides,
  }
}

describe("sendNotification", () => {
  let store: MemoryStore
  let now: { current: Date }

  beforeEach(() => {
    store = new MemoryStore()
    now = { current: new Date("2026-09-18T12:00:00.000Z") }
  })

  it("throws ORG_CONTEXT_REQUIRED before any write", async () => {
    await expect(
      sendNotification(
        {
          kind: "booking.confirmed",
          recipient: { userId: USER_ID },
          ctx: content,
          idempotencyKey: "booking:1:confirmed",
        } as SendNotificationInput,
        store.deps(now)
      )
    ).rejects.toMatchObject({ code: "ORG_CONTEXT_REQUIRED" })
    expect(store.rows.size).toBe(0)
    expect(store.sendCalls).toBe(0)
  })

  it("rejects channelsOverride that widens the kind", async () => {
    await expect(
      sendNotification(
        bookingInput({
          kind: "payment.receipt",
          idempotencyKey: "payment:1:receipt",
          channelsOverride: ["email", "sms"],
        }),
        store.deps(now)
      )
    ).rejects.toMatchObject({ code: "CHANNEL_OVERRIDE_INVALID" })
    expect(store.rows.size).toBe(0)
  })

  it("claims before calling Resend and writes an in-app row", async () => {
    const result = await sendNotification(bookingInput(), store.deps(now))
    expect(result.deliveries.map((row) => row.channel)).toEqual([
      "in_app",
      "email",
    ])
    expect(store.sendCalls).toBe(1)
    expect(store.inbox).toHaveLength(1)
    const email = result.deliveries.find((row) => row.channel === "email")
    expect(email?.status).toBe("sent")
    const claimed = [...store.rows.values()].find(
      (row) => row.channel === "email"
    )
    expect(claimed?.leaseOwner).toBeTruthy()
    expect(claimed?.firstAttemptAt).toEqual(now.current)
  })

  it("still writes in-app when Resend throws", async () => {
    await expect(
      sendNotification(bookingInput(), {
        ...store.deps(now),
        sendEmail: async () => {
          throw new Error("resend down")
        },
      })
    ).rejects.toThrow(/resend down/)
    expect(store.inbox).toHaveLength(1)
    expect(
      [...store.rows.values()].find((row) => row.channel === "in_app")?.status
    ).toBe("sent")
    expect(
      [...store.rows.values()].find((row) => row.channel === "email")?.status
    ).toBe("queued")
  })

  it("does not claim or send SMS in this slice", async () => {
    await sendNotification(bookingInput(), store.deps(now))
    expect([...store.rows.values()].some((row) => row.channel === "sms")).toBe(
      false
    )
  })

  it("returns the existing sent row for the same idempotency key", async () => {
    const deps = store.deps(now)
    await sendNotification(bookingInput(), deps)
    const second = await sendNotification(bookingInput(), {
      ...deps,
      runId: "worker-b",
    })
    expect(store.sendCalls).toBe(1)
    expect(store.inbox).toHaveLength(1)
    expect(second.deliveries.every((row) => row.status !== "queued")).toBe(true)
  })

  it("delivers both recipients for the same booking idempotency key", async () => {
    const deps = store.deps(now)
    await sendNotification(bookingInput(), deps)
    await sendNotification(
      bookingInput({ recipient: { userId: USER_B } }),
      deps
    )
    expect(store.sendCalls).toBe(2)
    expect(store.inbox).toHaveLength(2)
  })

  it("holds a fresh queued lease instead of double-sending", async () => {
    const deps = store.deps(now)
    deps.sendEmail = async () => {
      const overlapping = await sendNotification(bookingInput(), {
        ...store.deps(now),
        runId: "worker-b",
        sendEmail: async () => {
          throw new Error("worker-b should not send")
        },
      })
      expect(
        overlapping.deliveries.find((row) => row.channel === "email")?.status
      ).toBe("held")
      store.sendCalls += 1
      return { providerId: "re_1" }
    }
    const first = await sendNotification(bookingInput(), {
      ...deps,
      runId: "worker-a",
    })
    expect(first.deliveries.some((row) => row.status === "sent")).toBe(true)
    expect(store.sendCalls).toBe(1)
  })

  it("lets a stale worker reclaim after 60s", async () => {
    const deps = store.deps(now)
    deps.sendEmail = async () => {
      throw new Error("provider down")
    }
    await expect(
      sendNotification(bookingInput({ channelsOverride: ["email"] }), {
        ...deps,
        runId: "worker-a",
      })
    ).rejects.toThrow(/provider down/)
    expect(store.byId([...store.rows.values()][0]!.id)?.status).toBe("queued")

    now.current = new Date(now.current.getTime() + LEASE_TTL_MS + 1)
    const retry = await sendNotification(
      bookingInput({ channelsOverride: ["email"] }),
      { ...store.deps(now), runId: "worker-b" }
    )
    expect(retry.deliveries[0]?.status).toBe("sent")
    expect(store.sendCalls).toBe(1)
  })

  it("does not let a stale worker overwrite a newer lease result", async () => {
    const claimed = store.claim({
      runId: "worker-a",
      now: now.current,
      orgId: ORG_ID,
      idempotencyKey: "booking:1:confirmed",
      kind: "booking.confirmed",
      userId: USER_ID,
      recipientEmail: null,
      channel: "email",
    })
    now.current = new Date(now.current.getTime() + LEASE_TTL_MS + 1)
    const reclaimed = store.claim({
      runId: "worker-b",
      now: now.current,
      orgId: ORG_ID,
      idempotencyKey: "booking:1:confirmed",
      kind: "booking.confirmed",
      userId: USER_ID,
      recipientEmail: null,
      channel: "email",
    })
    expect(reclaimed.outcome).toBe("claimed")
    expect(
      store.complete({
        id: reclaimed.row.id,
        runId: "worker-b",
        claimedAt: reclaimed.row.claimedAt,
        status: "sent",
        providerId: "re_new",
      })
    ).toBe(true)
    expect(
      store.complete({
        id: claimed.row.id,
        runId: "worker-a",
        claimedAt: claimed.row.claimedAt,
        status: "failed",
        providerId: "re_old",
        error: "stale",
      })
    ).toBe(false)
    expect(store.byId(claimed.row.id)?.status).toBe("sent")
    expect(store.byId(claimed.row.id)?.providerId).toBe("re_new")
  })

  it("reclaims a failed delivery after the lease expires", async () => {
    const claimed = store.claim({
      runId: "worker-a",
      now: now.current,
      orgId: ORG_ID,
      idempotencyKey: "booking:1:confirmed",
      kind: "booking.confirmed",
      userId: USER_ID,
      recipientEmail: null,
      channel: "email",
    })
    const firstAttempt = now.current
    store.markFirstAttempt({
      id: claimed.row.id,
      runId: "worker-a",
      now: firstAttempt,
    })
    expect(
      store.complete({
        id: claimed.row.id,
        runId: "worker-a",
        claimedAt: claimed.row.claimedAt,
        status: "failed",
        error: "timeout",
      })
    ).toBe(true)

    now.current = new Date(now.current.getTime() + LEASE_TTL_MS + 1)
    const retry = await sendNotification(
      bookingInput({ channelsOverride: ["email"] }),
      { ...store.deps(now), runId: "worker-b" }
    )
    expect(retry.deliveries[0]?.status).toBe("sent")
    expect(store.byId(claimed.row.id)?.firstAttemptAt).toEqual(firstAttempt)
  })

  it("adopts a Resend message after 24h instead of sending again", async () => {
    const deps = store.deps(now)
    deps.completeDelivery = async () => false
    await sendNotification(bookingInput({ channelsOverride: ["email"] }), {
      ...deps,
      runId: "worker-a",
    })
    expect(store.sendCalls).toBe(1)
    const row = [...store.rows.values()][0]
    expect(row?.status).toBe("queued")

    now.current = new Date(
      now.current.getTime() + RESEND_IDEMPOTENCY_WINDOW_MS + 1
    )
    const retry = await sendNotification(
      bookingInput({ channelsOverride: ["email"] }),
      { ...store.deps(now), runId: "worker-b" }
    )
    expect(retry.deliveries[0]?.status).toBe("sent")
    expect(store.sendCalls).toBe(1)
    expect(store.listCalls).toBe(1)
  })

  it("skips Resend and marks suppressed addresses", async () => {
    const result = await sendNotification(
      bookingInput({ channelsOverride: ["email"] }),
      { ...store.deps(now), isEmailSuppressed: async () => true }
    )
    expect(result.deliveries[0]?.status).toBe("suppressed")
    expect(store.sendCalls).toBe(0)
  })

  it("email-mode guests get email only and no inbox row", async () => {
    const result = await sendNotification(
      bookingInput({
        recipient: { email: "guest@example.com", locale: "pt" },
      }),
      store.deps(now)
    )
    expect(result.deliveries.map((row) => row.channel)).toEqual(["email"])
    expect(store.inbox).toHaveLength(0)
    expect([...store.rows.values()][0]?.recipientEmail).toBe(
      "guest@example.com"
    )
    expect([...store.rows.values()][0]?.userId).toBeNull()
  })

  it("still emails required payment kinds when the preference is off", async () => {
    await sendNotification(
      bookingInput({
        kind: "payment.failed",
        idempotencyKey: "payment:1:failed",
        channelsOverride: ["email"],
      }),
      {
        ...store.deps(now),
        listPreferences: async () => [
          { channel: "email", category: "payment", enabled: false },
        ],
      }
    )
    expect(store.sendCalls).toBe(1)
  })

  it("honors a disabled booking email preference", async () => {
    const result = await sendNotification(bookingInput(), {
      ...store.deps(now),
      listPreferences: async () => [
        { channel: "email", category: "booking", enabled: false },
        { channel: "in_app", category: "booking", enabled: true },
      ],
    })
    expect(result.deliveries.map((row) => row.channel)).toEqual(["in_app"])
    expect(store.sendCalls).toBe(0)
    expect(store.inbox).toHaveLength(1)
  })

  it("does not accept invoice.issued", async () => {
    await expect(
      sendNotification(
        bookingInput({ kind: "invoice.issued" as never }),
        store.deps(now)
      )
    ).rejects.toMatchObject({ code: "VALIDATION" })
    expect(store.rows.size).toBe(0)
  })
})
