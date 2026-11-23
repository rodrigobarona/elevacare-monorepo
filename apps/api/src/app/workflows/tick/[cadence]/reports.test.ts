import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * What a tick reports (slice 13.18): each job for itself, through the same
 * wrapper its route uses, and the tick for itself.
 */

const reports: unknown[][] = []
vi.mock("@eleva/observability", () => ({
  captureException: vi.fn(async () => undefined),
  reportJobRun: vi.fn(async (...given: unknown[]) => {
    reports.push(given)
  }),
}))

vi.mock("@/lib/workflow-ticks", async () => {
  const { reportedJob } = await import("@/lib/reported-job")
  const done = async () => Response.json({ ok: true, expired: 0 })
  const failed = async () =>
    Response.json({ ok: false, error: "internal" }, { status: 500 })
  const threw = async (): Promise<Response> => {
    throw new Error("boom")
  }
  return {
    WORKFLOW_TICKS: {
      minutely: {
        "slot-reservation-expiry": reportedJob("slot-reservation-expiry", done),
        "booking-request-expiry": reportedJob("booking-request-expiry", failed),
        "domain-events-publisher": reportedJob(
          "domain-events-publisher",
          threw
        ),
        "video-eject-retry": reportedJob("video-eject-retry", done),
      },
      "10min": {
        "stripe-stuck-events": reportedJob("stripe-stuck-events", done),
      },
      hourly: {},
    },
    isWorkflowTickCadence: (value: string) =>
      ["minutely", "10min", "hourly"].includes(value),
  }
})

const authorize = vi.fn(async (): Promise<Response | null> => null)
vi.mock("@/lib/internal-workflow", () => ({
  authorizeInternalWorkflow: () => authorize(),
  internalWorkflowOptions: () => new Response(null, { status: 204 }),
}))

vi.mock("@eleva/config/env", () => ({
  env: () => ({ CRON_SECRET: "cron-secret" }),
}))

const { GET, POST } = await import("./route")

const context = (cadence: string) => ({ params: Promise.resolve({ cadence }) })
const url = (cadence: string) =>
  `https://api.eleva.care/workflows/tick/${cadence}`

describe("what a tick reports", () => {
  beforeEach(() => {
    reports.length = 0
    authorize.mockResolvedValue(null)
    vi.stubEnv("WORKFLOWS_DRAIN_SECRET", "inner-secret")
  })

  it("each job for itself, and the tick as done once all were called", async () => {
    const response = await POST(
      new Request(url("minutely"), { method: "POST" }),
      context("minutely")
    )
    // One job answered 500 and one threw: the tick's own answer says so.
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, failed: 2 })

    const children = reports.slice(0, -1)
    expect(children).toHaveLength(4)
    expect(children).toEqual(
      expect.arrayContaining([
        ["slot-reservation-expiry", "ok"],
        ["booking-request-expiry", "fail", "status 500"],
        ["domain-events-publisher", "fail", "threw"],
        ["video-eject-retry", "ok"],
      ])
    )
    // The tick reports last, after every job has answered: the schedule
    // fired and every job was called. Their failures are already said.
    expect(reports.at(-1)).toEqual(["tick-minutely", "ok"])
  })

  it("the same when Vercel Cron starts it", async () => {
    const response = await GET(
      new Request(url("10min"), {
        headers: { authorization: "Bearer cron-secret" },
      }),
      context("10min")
    )
    expect(response.status).toBe(200)
    expect(reports).toEqual([
      ["stripe-stuck-events", "ok"],
      ["tick-10min", "ok"],
    ])
  })

  it("a tick with no jobs still says the schedule fired", async () => {
    await POST(
      new Request(url("hourly"), { method: "POST" }),
      context("hourly")
    )
    expect(reports).toEqual([["tick-hourly", "ok"]])
  })

  it("nothing for a caller who is refused", async () => {
    const refused = await GET(
      new Request(url("minutely"), {
        headers: { authorization: "Bearer wrong" },
      }),
      context("minutely")
    )
    expect(refused.status).toBe(401)
    authorize.mockResolvedValue(
      Response.json({ error: "unauthorized" }, { status: 401 })
    )
    await POST(
      new Request(url("minutely"), { method: "POST" }),
      context("minutely")
    )
    expect(reports).toEqual([])
  })

  it("nothing for a cadence that does not exist", async () => {
    const response = await POST(
      new Request(url("daily"), { method: "POST" }),
      context("daily")
    )
    expect(response.status).toBe(404)
    expect(reports).toEqual([])
  })
})
