import { beforeEach, describe, expect, it, vi } from "vitest"

describe("publishPendingDomainEvents", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("succeeds one subscriber when the other throws", async () => {
    const updates: Array<{ id: string; status: string }> = []
    const deliveries = [
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
    ]

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
                limit: vi.fn().mockResolvedValue([{ id: "open" }]),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockImplementation((values: { status?: string }) => ({
              where: vi.fn().mockImplementation(async () => {
                if (values.status) {
                  updates.push({
                    id: String(updates.length + 1),
                    status: values.status,
                  })
                }
              }),
            })),
          }),
        }
        return fn(tx)
      }),
    }))

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
})
