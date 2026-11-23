import { beforeEach, describe, expect, it, vi } from "vitest"

type Result = {
  claimed: number
  succeeded: number
  failed: number
  dead: number
}
const none: Result = { claimed: 0, succeeded: 0, failed: 0, dead: 0 }

const {
  publishPendingDomainEvents,
  runJobAgain,
  runJobAt,
  afterResponse,
  logError,
} = vi.hoisted(() => ({
  publishPendingDomainEvents: vi.fn(),
  runJobAgain: vi.fn(async () => "asked" as const),
  runJobAt: vi.fn(async (..._args: unknown[]) => {}),
  afterResponse: vi.fn(() => true),
  logError: vi.fn(),
}))
vi.mock("@eleva/workflows/domain-events", () => ({
  publishPendingDomainEvents,
}))
vi.mock("@eleva/workflows/subscribers", () => ({
  defaultDomainEventSubscribers: () => ({}),
}))
vi.mock("@eleva/observability", () => ({ logError }))
vi.mock("./run-job-at", () => ({ runJobAgain, runJobAt }))
vi.mock("./after-response", () => ({ afterResponse }))

import {
  publishDomainEventsAfterResponse,
  publishDomainEventsNow,
} from "./publish-domain-events"

/** A pass that waits until it is let go, to hold a run open. */
function held(result: Result) {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  publishPendingDomainEvents.mockImplementationOnce(async () => {
    await gate
    return result
  })
  return release
}

describe("publishDomainEventsNow", () => {
  beforeEach(() => {
    publishPendingDomainEvents.mockReset()
    publishPendingDomainEvents.mockResolvedValue(none)
    runJobAgain.mockClear()
    runJobAt.mockClear()
    logError.mockClear()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("looks once when there is little to publish", async () => {
    publishPendingDomainEvents.mockResolvedValueOnce({
      ...none,
      claimed: 3,
      succeeded: 3,
    })
    await publishDomainEventsNow()
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(1)
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("looks again while a pass comes back full, and after four hands over to the job", async () => {
    publishPendingDomainEvents.mockResolvedValue({
      ...none,
      claimed: 25,
      succeeded: 25,
    })
    await publishDomainEventsNow()
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(4)
    // What is left is not left for the hour.
    expect(runJobAt).toHaveBeenCalledTimes(1)
    expect(runJobAt.mock.calls[0]![0]).toBe("domain-events-publisher")
  })

  it("does not hand over when the outbox was emptied", async () => {
    publishPendingDomainEvents
      .mockResolvedValueOnce({ ...none, claimed: 25, succeeded: 25 })
      .mockResolvedValueOnce({ ...none, claimed: 4, succeeded: 4 })
    await publishDomainEventsNow()
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(2)
    expect(runJobAt).not.toHaveBeenCalled()
  })

  it("is one run at a time, and a call made meanwhile gets one more pass", async () => {
    const release = held({ ...none, claimed: 1, succeeded: 1 })
    const first = publishDomainEventsNow()
    // Two more requests write events while the first pass is out.
    const second = publishDomainEventsNow()
    const third = publishDomainEventsNow()
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(1)
    release()
    await first
    // One more pass for both: their events may have been written after
    // the first pass looked.
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(2)
    // And the next call starts afresh.
    await publishDomainEventsNow()
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(3)
  })

  it("does not lose a call made during the last pass: the job is asked to go on", async () => {
    // Three full passes, then a fourth that is not full, with a request
    // writing an event while it is out.
    const full = { ...none, claimed: 25, succeeded: 25 }
    publishPendingDomainEvents
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(full)
    const release = held({ ...none, claimed: 2, succeeded: 2 })
    const first = publishDomainEventsNow()
    // Let the three passes go by, then call during the fourth.
    await vi.waitFor(() =>
      expect(publishPendingDomainEvents).toHaveBeenCalledTimes(4)
    )
    void publishDomainEventsNow()
    release()
    await first
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(4)
    expect(runJobAt).toHaveBeenCalledTimes(1)
    expect(runJobAt.mock.calls[0]![0]).toBe("domain-events-publisher")
  })

  it("does not lose a call made while a run is finishing", async () => {
    // The run has made its passes and is asking the job to try a failed
    // delivery again when another request writes an event.
    publishPendingDomainEvents.mockResolvedValueOnce({
      ...none,
      claimed: 1,
      failed: 1,
    })
    let letGo!: () => void
    runJobAgain.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          letGo = () => resolve("asked")
        })
    )
    const first = publishDomainEventsNow()
    await vi.waitFor(() => expect(runJobAgain).toHaveBeenCalledTimes(1))
    void publishDomainEventsNow()
    letGo()
    await first
    // A new run starts for it.
    await vi.waitFor(() =>
      expect(publishPendingDomainEvents).toHaveBeenCalledTimes(2)
    )
  })

  it("asks for a run that tries again when a delivery failed", async () => {
    publishPendingDomainEvents.mockResolvedValueOnce({
      ...none,
      claimed: 2,
      succeeded: 1,
      failed: 1,
    })
    await publishDomainEventsNow()
    expect(runJobAgain).toHaveBeenCalledWith("domain-events-publisher", 0)
  })

  it("does not ask again for a delivery that is given up on", async () => {
    publishPendingDomainEvents.mockResolvedValueOnce({
      ...none,
      claimed: 1,
      dead: 1,
    })
    await publishDomainEventsNow()
    expect(runJobAgain).not.toHaveBeenCalled()
  })

  it("never throws, and can be called again after a failure", async () => {
    publishPendingDomainEvents.mockRejectedValueOnce(
      new Error("database asleep")
    )
    await expect(publishDomainEventsNow()).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledTimes(1)
    await publishDomainEventsNow()
    expect(publishPendingDomainEvents).toHaveBeenCalledTimes(2)
  })
})

describe("publishDomainEventsAfterResponse", () => {
  it("publishes once the request has answered", () => {
    afterResponse.mockClear()
    publishDomainEventsAfterResponse()
    expect(afterResponse).toHaveBeenCalledWith(publishDomainEventsNow)
  })

  it("is quiet where there is no request", () => {
    afterResponse.mockReturnValueOnce(false)
    expect(() => publishDomainEventsAfterResponse()).not.toThrow()
  })
})
