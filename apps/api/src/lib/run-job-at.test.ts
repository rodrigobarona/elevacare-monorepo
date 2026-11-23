import { beforeEach, describe, expect, it, vi } from "vitest"

const { publishWorkflowJob, logError } = vi.hoisted(() => ({
  publishWorkflowJob: vi.fn(async () => "published" as const),
  logError: vi.fn(),
}))
vi.mock("./qstash-publish", () => ({ publishWorkflowJob }))
vi.mock("@eleva/observability", () => ({ logError }))

import { againNumber, runJobAgain, runJobAt } from "./run-job-at"

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
        id: `slot-reservation-expiry:${Date.parse("2026-12-01T10:05:00Z") / 1000}`,
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

  it("comes back soon, then further apart, each run knowing its number", async () => {
    expect(await runJobAgain("video-eject-retry", 0, NOW)).toBe("asked")
    expect(await runJobAgain("video-eject-retry", 1, NOW)).toBe("asked")
    expect(await runJobAgain("video-eject-retry", 2, NOW)).toBe("asked")
    expect(
      sent().map((one) => [
        (Date.parse(one.notBefore) - NOW.getTime()) / 1000,
        one.body,
      ])
    ).toEqual([
      [90, { again: 1 }],
      [300, { again: 2 }],
      [900, { again: 3 }],
    ])
  })

  it("stops after the last step and leaves it to the hourly tick", async () => {
    expect(await runJobAgain("video-eject-retry", 3, NOW)).toBe(
      "left to the tick"
    )
    expect(await runJobAgain("video-eject-retry", 40, NOW)).toBe(
      "left to the tick"
    )
    expect(publishWorkflowJob).not.toHaveBeenCalled()
  })

  it("can never ask for more than an hour of runs in all", () => {
    // Read from what the three steps add up to: after that the tick has run.
    const total = 90 + 300 + 900
    expect(total).toBeLessThan(60 * 60)
  })
})

describe("againNumber", () => {
  const request = (body: string | undefined) =>
    new Request("https://api.eleva.test/workflows/video-eject-retry", {
      method: "POST",
      ...(body === undefined ? {} : { body }),
    })

  it("reads which run this is", async () => {
    expect(await againNumber(request('{"again":2}'))).toBe(2)
  })

  it.each([
    ["the tick's empty body", "{}"],
    ["no body", undefined],
    ["not JSON", "again"],
    ["a text", '{"again":"2"}'],
    ["a fraction", '{"again":1.5}'],
    ["a negative number", '{"again":-1}'],
    ["null", "null"],
  ])("is a first run for %s", async (_what, body) => {
    expect(await againNumber(request(body))).toBe(0)
  })

  it("leaves the body for the handler to read", async () => {
    const asked = request('{"again":1}')
    await againNumber(asked)
    expect(await asked.json()).toEqual({ again: 1 })
  })
})
