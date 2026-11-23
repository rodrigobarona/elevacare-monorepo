import { beforeEach, describe, expect, it, vi } from "vitest"

const { publishWorkflowJob, logError } = vi.hoisted(() => ({
  publishWorkflowJob: vi.fn(
    async (): Promise<"published" | "inline"> => "published"
  ),
  logError: vi.fn(),
}))
vi.mock("./qstash-publish", () => ({ publishWorkflowJob }))
vi.mock("@eleva/observability", () => ({ logError }))

import { againSteps, runJobAgain, runJobAt, whichRun } from "./run-job-at"

const NOW = new Date("2026-12-01T10:00:00.000Z")
const at = (iso: string) => new Date(iso)
const sent = () =>
  publishWorkflowJob.mock.calls.map((call) => {
    const [path, body, later] = call as unknown as [
      string,
      Record<string, unknown>,
      { notBefore: Date; deduplicationId: string },
    ]
    return {
      path,
      body,
      notBefore: later.notBefore.toISOString(),
      id: later.deduplicationId,
    }
  })

describe("runJobAt", () => {
  beforeEach(() => {
    publishWorkflowJob.mockClear()
    publishWorkflowJob.mockResolvedValue("published")
    logError.mockClear()
  })

  it("asks for one run of the job at that moment", async () => {
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:00Z"),
      {},
      NOW
    )
    expect(sent()).toEqual([
      {
        path: "/workflows/slot-reservation-expiry",
        body: {},
        notBefore: "2026-12-01T10:05:00.000Z",
        id: `slot-reservation-expiry:${Date.parse("2026-12-01T10:05:00Z") / 1000}:0`,
      },
    ])
  })

  it("never asks for a run before the moment: it rounds up", async () => {
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:00.400Z"),
      {},
      NOW
    )
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:29Z"),
      {},
      NOW
    )
    expect(sent().map((one) => one.notBefore)).toEqual([
      "2026-12-01T10:05:30.000Z",
      "2026-12-01T10:05:30.000Z",
    ])
  })

  it("gives items due close together the same id, so the queue sends one message", async () => {
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:03Z"),
      {},
      NOW
    )
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:21Z"),
      {},
      NOW
    )
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T10:05:31Z"),
      {},
      NOW
    )
    const ids = sent().map((one) => one.id)
    expect(ids[0]).toBe(ids[1])
    expect(ids[2]).not.toBe(ids[0])
    // And never the id of another job due at the same moment.
    await runJobAt("video-eject-retry", at("2026-12-01T10:05:03Z"), {}, NOW)
    expect(sent()[3]!.id).not.toBe(ids[0])
  })

  it("takes a moment already past as a few seconds from now", async () => {
    await runJobAt(
      "slot-reservation-expiry",
      at("2026-12-01T09:00:00Z"),
      {},
      NOW
    )
    const [one] = sent()
    expect(Date.parse(one!.notBefore)).toBeGreaterThanOrEqual(
      NOW.getTime() + 5_000
    )
    expect(Date.parse(one!.notBefore)).toBeLessThanOrEqual(
      NOW.getTime() + 35_000
    )
  })

  it("does not throw when the queue refuses, and says what was not scheduled", async () => {
    publishWorkflowJob.mockRejectedValueOnce(new Error("quota"))
    await expect(
      runJobAt("slot-reservation-expiry", at("2026-12-01T10:05:00Z"), {}, NOW)
    ).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledTimes(1)
    expect(String(logError.mock.calls[0]![0])).toContain(
      "slot-reservation-expiry"
    )
  })
})

describe("runJobAgain", () => {
  beforeEach(() => {
    publishWorkflowJob.mockClear()
    publishWorkflowJob.mockResolvedValue("published")
  })

  const waits = () =>
    sent().map((one) => [
      (Date.parse(one.notBefore) - NOW.getTime()) / 1000,
      one.body,
    ])

  it("comes back soon, then further apart, each run knowing its number", async () => {
    expect(await runJobAgain("domain-events-publisher", 0, NOW)).toBe("asked")
    expect(await runJobAgain("domain-events-publisher", 1, NOW)).toBe("asked")
    expect(await runJobAgain("domain-events-publisher", 2, NOW)).toBe("asked")
    expect(waits()).toEqual([
      [90, { again: 1 }],
      [300, { again: 2 }],
      [900, { again: 3 }],
    ])
  })

  it("stops after the last step and leaves it to the hourly tick", async () => {
    expect(await runJobAgain("domain-events-publisher", 3, NOW)).toBe(
      "left to the tick"
    )
    expect(await runJobAgain("slot-reservation-expiry", 40, NOW)).toBe(
      "left to the tick"
    )
    expect(publishWorkflowJob).not.toHaveBeenCalled()
  })

  it("can use the few default steps for a job that has denser ones of its own", async () => {
    expect(await runJobAgain("video-eject-retry", 0, NOW, "few")).toBe("asked")
    expect(await runJobAgain("video-eject-retry", 3, NOW, "few")).toBe(
      "left to the tick"
    )
    expect(waits()).toEqual([[90, { again: 1 }]])
  })

  it("gives a step its own message, so a first run in the same half minute does not swallow it", async () => {
    const when = at("2026-12-01T10:05:00Z")
    await runJobAt("video-eject-retry", when, {}, NOW)
    await runJobAt("video-eject-retry", when, { again: 2 }, NOW)
    const [first, step] = sent()
    expect(first!.notBefore).toBe(step!.notBefore)
    expect(first!.id).not.toBe(step!.id)
  })
})

describe("the steps of each job", () => {
  const JOBS = [
    "slot-reservation-expiry",
    "domain-events-publisher",
    "video-eject-retry",
  ] as const

  it.each(JOBS)("%s ends within the hour, when the tick runs anyway", (job) => {
    const steps = againSteps(job)
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.reduce((sum, wait) => sum + wait, 0)).toBeLessThanOrEqual(
      60 * 60
    )
    for (const wait of steps) expect(wait).toBeGreaterThanOrEqual(60)
  })

  it("tries hardest for someone still in a call they were removed from", () => {
    const steps = againSteps("video-eject-retry")
    // Within a minute at first, as it was when a job ran every minute.
    expect(steps[0]).toBe(60)
    // Never more than ten minutes between two tries.
    expect(Math.max(...steps)).toBeLessThanOrEqual(10 * 60)
    // And it covers the hour until the tick, which starts it again.
    const covered = steps.reduce((sum, wait) => sum + wait, 0)
    expect(covered).toBeGreaterThanOrEqual(50 * 60)
    expect(steps.length).toBeGreaterThan(
      againSteps("domain-events-publisher").length
    )
  })
})

describe("runJobAt with no queue", () => {
  it("says so once where it is deployed, and not on a laptop", async () => {
    publishWorkflowJob.mockClear()
    logError.mockClear()
    publishWorkflowJob.mockResolvedValue("inline")
    const when = at("2026-12-01T10:05:00Z")

    await runJobAt("slot-reservation-expiry", when, {}, NOW)
    expect(logError).not.toHaveBeenCalled()

    vi.stubEnv("VERCEL_ENV", "production")
    await runJobAt("slot-reservation-expiry", when, {}, NOW)
    await runJobAt("slot-reservation-expiry", when, {}, NOW)
    vi.unstubAllEnvs()
    expect(logError).toHaveBeenCalledTimes(1)
    expect(String(logError.mock.calls[0]![0])).toContain("no queue")
  })
})

describe("whichRun", () => {
  const request = (body: string | undefined) =>
    new Request("https://api.eleva.test/workflows/video-eject-retry", {
      method: "POST",
      ...(body === undefined ? {} : { body }),
    })

  it("reads which run this is", async () => {
    expect(await whichRun(request('{"again":2}'))).toEqual({
      again: 2,
      fromTick: false,
    })
  })

  it("reads that the tick sent it", async () => {
    expect(await whichRun(request('{"tick":true}'))).toEqual({
      again: 0,
      fromTick: true,
    })
  })

  it.each([
    ["an empty body", "{}"],
    ["no body", undefined],
    ["not JSON", "again"],
    ["a text", '{"again":"2"}'],
    ["a fraction", '{"again":1.5}'],
    ["a negative number", '{"again":-1}'],
    ["a number past any ladder", '{"again":5000}'],
    ["a tick that is not true", '{"tick":"yes"}'],
    ["null", "null"],
  ])("is a first run, not from the tick, for %s", async (_what, body) => {
    expect(await whichRun(request(body))).toEqual({
      again: 0,
      fromTick: false,
    })
  })

  it("leaves the job's own input alone, and the body for the handler to read", async () => {
    const asked = request('{"again":1,"bookingId":"b1"}')
    expect(await whichRun(asked)).toEqual({ again: 1, fromTick: false })
    expect(await asked.json()).toEqual({ again: 1, bookingId: "b1" })
  })
})
