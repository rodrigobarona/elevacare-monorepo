import { beforeEach, describe, expect, it, vi } from "vitest"

type DeliveryRow = {
  id: string
  eventId: string
  subscriberId: string
  attempts: number
  orgId: string
  type: string
  payload: Record<string, unknown>
}

function mockPublisherDb(
  deliveries: DeliveryRow[],
  updates: Array<Record<string, unknown>>
) {
  vi.doMock("@eleva/db", () => ({
    main: {
      domainEventDeliveries: {
        id: "id",
        eventId: "event_id",
        subscriberId: "subscriber_id",
        attempts: "attempts",
        orgId: "org_id",
        status: "status",
      },
      domainEventsOutbox: {
        id: "id",
        type: "type",
        payload: "payload",
      },
    },
    withPlatformAdminContext: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        execute: vi.fn().mockResolvedValue({
          rows: deliveries.map((row) => ({ id: row.id })),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(deliveries),
            }),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(async () => {
                const open = updates.some(
                  (row) =>
                    row.status === "pending" ||
                    row.status === "processing" ||
                    row.status === "failed"
                )
                return open ? [{ id: "open" }] : []
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi
            .fn()
            .mockImplementation((values: Record<string, unknown>) => ({
              where: vi.fn().mockImplementation(async () => {
                updates.push(values)
              }),
            })),
        }),
      }
      return fn(tx)
    }),
  }))
}

describe("publishPendingDomainEvents", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("succeeds one subscriber when the other throws", async () => {
    const updates: Array<Record<string, unknown>> = []
    mockPublisherDb(
      [
        {
          id: "d1",
          eventId: "e1",
          subscriberId: "ok",
          attempts: 1,
          orgId: "org-1",
          type: "booking.guest_activation_required",
          payload: { bookingId: "b1" },
        },
        {
          id: "d2",
          eventId: "e1",
          subscriberId: "boom",
          attempts: 1,
          orgId: "org-1",
          type: "booking.guest_activation_required",
          payload: { bookingId: "b1" },
        },
      ],
      updates
    )

    const { publishPendingDomainEvents } = await import("./domain-events")
    const ok = vi.fn().mockResolvedValue(undefined)
    const boom = vi.fn().mockRejectedValue(new Error("subscriber exploded"))
    const result = await publishPendingDomainEvents({
      subscribers: { ok, boom },
    })

    expect(ok).toHaveBeenCalledTimes(1)
    expect(boom).toHaveBeenCalledTimes(1)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(updates.map((row) => row.status)).toContain("succeeded")
    expect(updates.map((row) => row.status)).toContain("failed")
  })

  it("does not claim logging-only deliveries or mark them succeeded", async () => {
    const updates: Array<Record<string, unknown>> = []
    mockPublisherDb([], updates)

    const { publishPendingDomainEvents } = await import("./domain-events")
    const logger = vi.fn()
    const result = await publishPendingDomainEvents({
      subscribers: { logger },
    })

    expect(logger).not.toHaveBeenCalled()
    expect(result.claimed).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(updates).toEqual([])
  })

  it("fails unknown non-deferred subscribers instead of leaving them pending", async () => {
    const updates: Array<Record<string, unknown>> = []
    mockPublisherDb(
      [
        {
          id: "d1",
          eventId: "e1",
          subscriberId: "typo-subscriber",
          attempts: 1,
          orgId: "org-1",
          type: "booking.guest_activation_required",
          payload: { bookingId: "b1" },
        },
      ],
      updates
    )

    const { publishPendingDomainEvents } = await import("./domain-events")
    const result = await publishPendingDomainEvents({
      subscribers: { ok: vi.fn() },
    })

    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(updates.map((row) => row.status)).toContain("failed")
  })

  it("succeeds send-notification once the handler is registered", async () => {
    const updates: Array<Record<string, unknown>> = []
    mockPublisherDb(
      [
        {
          id: "d1",
          eventId: "e1",
          subscriberId: "send-notification",
          attempts: 1,
          orgId: "org-1",
          type: "invoice.blocked",
          payload: {
            invoiceKind: "platform_fee",
            invoiceId: "inv-1",
            bookingPaymentId: "pay-1",
            status: "blocked",
          },
        },
      ],
      updates
    )

    const { publishPendingDomainEvents } = await import("./domain-events")
    const sendNotification = vi.fn().mockResolvedValue(undefined)
    const result = await publishPendingDomainEvents({
      subscribers: { "send-notification": sendNotification },
    })

    expect(sendNotification).toHaveBeenCalledTimes(1)
    expect(result.succeeded).toBe(1)
    expect(updates.map((row) => row.status)).toContain("succeeded")
  })
})
