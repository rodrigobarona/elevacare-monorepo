import { beforeEach, describe, expect, it, vi } from "vitest"

const reportJobRun = vi.fn(async (..._given: unknown[]) => undefined)
vi.mock("@eleva/observability", () => ({
  reportJobRun: (...given: unknown[]) => reportJobRun(...given),
}))

const { reportedJob } = await import("./reported-job")

const request = () =>
  new Request("https://api.eleva.care/workflows/keep-alive", { method: "POST" })

describe("reportedJob", () => {
  beforeEach(() => reportJobRun.mockClear())

  it.each([200, 201, 204])("reports done for %i", async (status) => {
    const response = new Response(null, { status })
    const run = reportedJob("keep-alive", async () => response)
    // The answer is the handler's own, untouched.
    expect(await run()).toBe(response)
    expect(reportJobRun.mock.calls).toEqual([["keep-alive", "ok"]])
  })

  it("reports done for a run that had nothing to do", async () => {
    const run = reportedJob("slot-reservation-expiry", async () =>
      Response.json({ ok: true, expired: 0 })
    )
    const response = await run()
    expect(await response.json()).toEqual({ ok: true, expired: 0 })
    expect(reportJobRun.mock.calls).toEqual([["slot-reservation-expiry", "ok"]])
  })

  it.each([500, 502, 504])(
    "reports failed for %i, with the status only",
    async (status) => {
      const response = Response.json(
        { ok: false, error: "internal", message: "member 42 not found" },
        { status }
      )
      const run = reportedJob("invoicing-retry", async () => response)
      expect(await run()).toBe(response)
      expect(reportJobRun.mock.calls).toEqual([
        ["invoicing-retry", "fail", `status ${status}`],
      ])
    }
  )

  it("reports failed for a throw, and passes the throw on as it was", async () => {
    const boom = new Error("member 42 not found")
    const run = reportedJob(
      "audit-outbox-drainer",
      async (): Promise<Response> => {
        throw boom
      }
    )
    await expect(run()).rejects.toBe(boom)
    // Why it threw may name a person: only "threw" is reported.
    expect(reportJobRun.mock.calls).toEqual([
      ["audit-outbox-drainer", "fail", "threw"],
    ])
  })

  it.each([401, 403, 404, 422, 429])(
    "reports nothing for %i: the caller was refused before the job began",
    async (status) => {
      const response = Response.json({ error: "refused" }, { status })
      const run = reportedJob("keep-alive", async () => response)
      expect(await run()).toBe(response)
      expect(reportJobRun).not.toHaveBeenCalled()
    }
  )

  it("reports after the work is done, and before the answer is returned", async () => {
    const order: string[] = []
    reportJobRun.mockImplementationOnce(async () => {
      order.push("report began")
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push("report ended")
      return undefined
    })
    const run = reportedJob("keep-alive", async () => {
      order.push("work done")
      return new Response(null, { status: 200 })
    })
    await run()
    order.push("answered")
    expect(order).toEqual([
      "work done",
      "report began",
      "report ended",
      "answered",
    ])
  })

  it("passes the handler what it was given", async () => {
    const handler = vi.fn(async (_request: Request, _context: { id: string }) =>
      Response.json({ ok: true })
    )
    const run = reportedJob("keep-alive", handler)
    const given = request()
    await run(given, { id: "a" })
    expect(handler).toHaveBeenCalledWith(given, { id: "a" })
  })

  it("ends on done when a failed attempt is retried and succeeds", async () => {
    const answers = [500, 500, 200]
    const run = reportedJob("process-pending-payouts", async () =>
      Response.json({}, { status: answers.shift()! })
    )
    await run()
    await run()
    await run()
    expect(reportJobRun.mock.calls).toEqual([
      ["process-pending-payouts", "fail", "status 500"],
      ["process-pending-payouts", "fail", "status 500"],
      ["process-pending-payouts", "ok"],
    ])
  })
})
