import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Three jobs of the hourly tick whose work cannot wait an hour ask to be
 * run again at the moment it is needed: a hold that lapses, a delivery
 * that failed, a person still in a call they were removed from.
 */

const {
  expireStaleReservations,
  nextReservationExpiry,
  publishPasses,
  retryPendingEjects,
  runJobAt,
  runJobAgain,
  logError,
} = vi.hoisted(() => ({
  expireStaleReservations: vi.fn(),
  nextReservationExpiry: vi.fn(),
  publishPasses: vi.fn(),
  retryPendingEjects: vi.fn(),
  runJobAt: vi.fn(async (..._args: unknown[]) => {}),
  runJobAgain: vi.fn(async (..._args: unknown[]) => "asked" as const),
  logError: vi.fn(),
}))

vi.mock("@eleva/workflows/scheduling", () => ({
  expireStaleReservations,
  SLOT_RESERVATION_EXPIRY_BATCH_SIZE: 100,
}))
vi.mock("@eleva/scheduling", () => ({ nextReservationExpiry }))
vi.mock("@/lib/publish-domain-events", () => ({ publishPasses }))
vi.mock("@eleva/workflows/video", () => ({ retryPendingEjects }))
vi.mock("@eleva/observability", () => ({
  logError,
  captureException: vi.fn(async () => {}),
  reportJobRun: vi.fn(async () => {}),
}))
vi.mock("@/lib/internal-workflow", async (original) => ({
  ...(await original<typeof import("@/lib/internal-workflow")>()),
  authorizeInternalWorkflow: vi.fn(async () => null),
  runInternalWorkflow: async (
    _request: Request,
    run: () => Promise<Record<string, unknown>>
  ) => Response.json({ ...(await run()), ok: true }),
}))
vi.mock("@/lib/run-job-at", async (original) => ({
  ...(await original<typeof import("@/lib/run-job-at")>()),
  runJobAt,
  runJobAgain,
}))

import { POST as holds } from "./slot-reservation-expiry/route"
import { POST as publisher } from "./domain-events-publisher/route"
import { POST as ejects } from "./video-eject-retry/route"

const run = (
  handler: (request: Request) => Promise<Response>,
  name: string,
  body: Record<string, unknown> = {}
) =>
  handler(
    new Request(`https://api.eleva.test/workflows/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )

/** What the hourly tick sends each job. */
const TICK = { tick: true }

beforeEach(() => {
  for (const mock of [
    expireStaleReservations,
    nextReservationExpiry,
    publishPasses,
    retryPendingEjects,
    runJobAt,
    runJobAgain,
    logError,
  ]) {
    mock.mockReset()
  }
  runJobAgain.mockResolvedValue("asked")
})

describe("the job that releases lapsed holds", () => {
  const expired = (over: Record<string, number> = {}) => ({
    scanned: 0,
    expired: 0,
    kept: 0,
    retried: 0,
    bookingsCancelled: 0,
    linkUsesReleased: 0,
    errors: 0,
    ...over,
  })

  it("asks for nothing when no hold is held", async () => {
    expireStaleReservations.mockResolvedValue(expired())
    nextReservationExpiry.mockResolvedValue(null)
    const answer = await run(holds, "slot-reservation-expiry")
    expect(answer.status).toBe(200)
    expect(runJobAt).not.toHaveBeenCalled()
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("asks to be run when the next hold lapses", async () => {
    const next = new Date("2026-12-01T10:09:00.000Z")
    expireStaleReservations.mockResolvedValue(
      expired({ scanned: 1, expired: 1 })
    )
    nextReservationExpiry.mockResolvedValue(next)
    await run(holds, "slot-reservation-expiry")
    expect(runJobAt).toHaveBeenCalledWith("slot-reservation-expiry", next)
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("still asks for the next lapse when the tick ran it", async () => {
    const next = new Date("2026-12-01T10:09:00.000Z")
    expireStaleReservations.mockResolvedValue(expired())
    nextReservationExpiry.mockResolvedValue(next)
    await run(holds, "slot-reservation-expiry", TICK)
    expect(runJobAt).toHaveBeenCalledWith("slot-reservation-expiry", next)
  })

  it("comes back soon when a hold could not be dealt with, knowing which run it is", async () => {
    expireStaleReservations.mockResolvedValue(
      expired({ scanned: 2, errors: 1 })
    )
    nextReservationExpiry.mockResolvedValue(null)
    await run(holds, "slot-reservation-expiry", { again: 1 })
    expect(runJobAgain).toHaveBeenCalledWith("slot-reservation-expiry", 1)
  })

  it("does not start those runs from the tick: a hold that never works would restart them every hour", async () => {
    expireStaleReservations.mockResolvedValue(
      expired({ scanned: 2, errors: 1 })
    )
    nextReservationExpiry.mockResolvedValue(null)
    await run(holds, "slot-reservation-expiry", TICK)
    expect(runJobAgain).not.toHaveBeenCalled()
    expect(runJobAt).not.toHaveBeenCalled()
  })

  it("goes on at once after a full batch, from the tick too: more are waiting", async () => {
    expireStaleReservations.mockResolvedValue(
      expired({ scanned: 100, expired: 100 })
    )
    nextReservationExpiry.mockResolvedValue(null)
    await run(holds, "slot-reservation-expiry", TICK)
    expect(runJobAt).toHaveBeenCalledTimes(1)
    expect(runJobAt.mock.calls[0]![0]).toBe("slot-reservation-expiry")
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("still answers with what it did when the next run cannot be asked for", async () => {
    expireStaleReservations.mockResolvedValue(
      expired({ scanned: 1, expired: 1 })
    )
    nextReservationExpiry.mockRejectedValue(new Error("database asleep"))
    const answer = await run(holds, "slot-reservation-expiry")
    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({ ok: true, expired: 1 })
    expect(logError).toHaveBeenCalledTimes(1)
  })
})

describe("the job that publishes events", () => {
  const published = (over: Record<string, number | boolean> = {}) => ({
    claimed: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    more: false,
    ...over,
  })

  it("makes as many passes as a run can, not one", async () => {
    publishPasses.mockResolvedValue(published({ claimed: 60, succeeded: 60 }))
    const answer = await run(publisher, "domain-events-publisher")
    expect(publishPasses).toHaveBeenCalledWith(20)
    expect(await answer.json()).toEqual({
      ok: true,
      claimed: 60,
      succeeded: 60,
      failed: 0,
      dead: 0,
    })
    expect(runJobAgain).not.toHaveBeenCalled()
    expect(runJobAt).not.toHaveBeenCalled()
  })

  it("goes on at once when a run did not empty the outbox", async () => {
    publishPasses.mockResolvedValue(
      published({ claimed: 500, succeeded: 500, more: true })
    )
    await run(publisher, "domain-events-publisher", TICK)
    expect(runJobAt).toHaveBeenCalledTimes(1)
    expect(runJobAt.mock.calls[0]![0]).toBe("domain-events-publisher")
  })

  it("asks for the run that tries a failed delivery again", async () => {
    publishPasses.mockResolvedValue(
      published({ claimed: 2, succeeded: 1, failed: 1 })
    )
    await run(publisher, "domain-events-publisher", { again: 2 })
    expect(runJobAgain).toHaveBeenCalledWith("domain-events-publisher", 2)
  })

  it("does not start those runs from the tick", async () => {
    publishPasses.mockResolvedValue(
      published({ claimed: 2, succeeded: 1, failed: 1 })
    )
    await run(publisher, "domain-events-publisher", TICK)
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("does not come back for a delivery it has given up on", async () => {
    publishPasses.mockResolvedValue(published({ claimed: 1, dead: 1 }))
    await run(publisher, "domain-events-publisher")
    expect(runJobAgain).not.toHaveBeenCalled()
  })
})

describe("the job that finishes removing people from calls", () => {
  const retried = (pending: number, capacityPending = 0) => ({
    scanned: pending,
    ejected: 0,
    pending,
    capacity: {
      scanned: capacityPending,
      repaired: 0,
      pending: capacityPending,
    },
  })

  it("asks for nothing when nobody is left", async () => {
    retryPendingEjects.mockResolvedValue(retried(0))
    await run(ejects, "video-eject-retry")
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("comes back while someone removed is still in a call", async () => {
    retryPendingEjects.mockResolvedValue(retried(1))
    await run(ejects, "video-eject-retry", { again: 1 })
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 1)
  })

  it("comes back while a room is still too small for someone added", async () => {
    retryPendingEjects.mockResolvedValue(retried(0, 1))
    await run(ejects, "video-eject-retry")
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 0)
  })

  it("starts the tries again from the tick, unlike the other jobs: someone is still in a call", async () => {
    retryPendingEjects.mockResolvedValue(retried(1))
    await run(ejects, "video-eject-retry", TICK)
    expect(runJobAgain).toHaveBeenCalledWith("video-eject-retry", 0)
  })
})
