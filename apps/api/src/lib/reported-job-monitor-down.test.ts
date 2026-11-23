import { afterEach, describe, expect, it, vi } from "vitest"
import { reportedJob } from "./reported-job"

/**
 * The wrapper and the real reporter together, with a monitor in trouble:
 * what the job answers must not change (slice 13.18).
 */

const ADDRESS = "https://monitor.example/api/v1/heartbeat/tok3n"

function monitor(answer: number | "down" | "hangs") {
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    if (answer === "down") throw new TypeError("fetch failed")
    if (answer === "hangs") {
      await new Promise((_resolve, reject) => {
        const timedOut = () =>
          reject(new DOMException("timed out", "TimeoutError"))
        if (init?.signal?.aborted) timedOut()
        else init?.signal?.addEventListener("abort", timedOut)
      })
    }
    return new Response(null, { status: answer as number })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("a job whose monitor is in trouble", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const setUp = (answer: Parameters<typeof monitor>[0], marker: string) => {
    // A value of its own per case, so the reporter reads the setting anew.
    vi.stubEnv(
      "BETTERSTACK_HEARTBEAT_URLS",
      JSON.stringify({ "keep-alive": `${ADDRESS}-${marker}` })
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
      AbortSignal.abort(new DOMException("timed out", "TimeoutError"))
    )
    return monitor(answer)
  }

  it.each([
    ["cannot be reached", "down"],
    ["never answers", "hangs"],
    ["does not know the address", 404],
    ["is failing", 503],
  ] as const)(
    "answers as it would have when the monitor %s",
    async (what, answer) => {
      const fetchMock = setUp(answer, `ok-${answer}`)
      const done = Response.json({ ok: true, expired: 3 })
      const run = reportedJob("keep-alive", async () => done)
      const response = await run()
      expect(response).toBe(done)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true, expired: 3 })
      expect(fetchMock, what).toHaveBeenCalled()
    }
  )

  it.each([
    ["cannot be reached", "down"],
    ["never answers", "hangs"],
    ["does not know the address", 404],
  ] as const)(
    "fails as it would have when the monitor %s",
    async (_what, answer) => {
      const fetchMock = setUp(answer, `fail-${answer}`)
      const failed = Response.json(
        { ok: false, error: "internal" },
        { status: 500 }
      )
      expect(await reportedJob("keep-alive", async () => failed)()).toBe(failed)

      // A throw is still the job's own, not the monitor's.
      const boom = new Error("boom")
      await expect(
        reportedJob("keep-alive", async (): Promise<Response> => {
          throw boom
        })()
      ).rejects.toBe(boom)
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/fail$/)
    }
  )

  it("asks nothing with no monitoring account", async () => {
    const fetchMock = monitor(200)
    vi.stubEnv("BETTERSTACK_HEARTBEAT_URLS", "")
    const done = Response.json({ ok: true })
    expect(await reportedJob("keep-alive", async () => done)()).toBe(done)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
