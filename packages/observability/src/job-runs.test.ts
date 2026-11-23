import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BACKGROUND_JOBS } from "@eleva/config/background-jobs"

type Report = (typeof import("./job-runs"))["reportJobRun"]

/**
 * The reporter, loaded anew for each test: it remembers the setting it
 * last read, and a test must not see what an earlier one left.
 */
const reportJobRun: Report = async (...given) =>
  (await import("./job-runs")).reportJobRun(...given)

const ADDRESS = "https://monitor.example/api/v1/heartbeat"
const SECRET = "tok3nTok3nTok3nTok3nTok3n"

type Call = { url: string; method?: string; body?: unknown }

/** A monitor that answers each request with the next of `answers`. */
function monitor(...answers: (number | "down" | "hangs")[]) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method, body: init?.body })
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
    if (answer === "down") throw new TypeError("fetch failed")
    if (answer === "hangs") {
      // What a request that gets no answer does when its time is up.
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
  return { calls, fetchMock }
}

function configure(urls: unknown) {
  vi.stubEnv(
    "BETTERSTACK_HEARTBEAT_URLS",
    typeof urls === "string" ? urls : JSON.stringify(urls)
  )
}

describe("reportJobRun", () => {
  let errors: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    errors = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Everything logged, as one text. */
  const logged = () => errors.mock.calls.flat().join(" ")

  describe("with no monitoring account", () => {
    it.each([undefined, "", "   "])(
      "asks nothing and logs nothing when the setting is %j",
      async (value) => {
        // Also for `undefined`: a value in the shell that runs the tests
        // must not decide this case.
        vi.stubEnv("BETTERSTACK_HEARTBEAT_URLS", value)
        const { fetchMock } = monitor(200)
        for (const job of Object.keys(BACKGROUND_JOBS)) {
          await reportJobRun(job as keyof typeof BACKGROUND_JOBS, "ok")
          await reportJobRun(job as keyof typeof BACKGROUND_JOBS, "fail")
        }
        expect(fetchMock).not.toHaveBeenCalled()
        expect(errors).not.toHaveBeenCalled()
      }
    )
  })

  describe("where each job reports", () => {
    it("is the job's own address, as it was given", async () => {
      configure({
        "keep-alive": `${ADDRESS}/${SECRET}`,
        "tick-minutely": "https://other.example/hb/abc/",
      })
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      await reportJobRun("tick-minutely", "ok")
      expect(calls).toEqual([
        { url: `${ADDRESS}/${SECRET}`, method: "POST", body: undefined },
        // A slash at the end is not part of the address.
        {
          url: "https://other.example/hb/abc",
          method: "POST",
          body: undefined,
        },
      ])
    })

    it("is nowhere for a job that has no address, while others report", async () => {
      configure({ "keep-alive": `${ADDRESS}/${SECRET}` })
      const { calls } = monitor(200)
      await reportJobRun("invoicing-retry", "ok")
      await reportJobRun("invoicing-retry", "fail", "status 500")
      expect(calls).toEqual([])
      await reportJobRun("keep-alive", "ok")
      expect(calls).toHaveLength(1)
      expect(errors).not.toHaveBeenCalled()
    })

    it("reaches every scheduled job when every one has an address", async () => {
      const names = Object.keys(
        BACKGROUND_JOBS
      ) as (keyof typeof BACKGROUND_JOBS)[]
      configure(
        Object.fromEntries(
          names.map((name) => [name, `${ADDRESS}/${name}-token`])
        )
      )
      const { calls } = monitor(200)
      for (const name of names) await reportJobRun(name, "ok")
      expect(calls.map((call) => call.url)).toEqual(
        names.map((name) => `${ADDRESS}/${name}-token`)
      )
    })

    it("is nowhere for a job that runs on demand, even if given an address", async () => {
      configure({ "dsar-export": `${ADDRESS}/${SECRET}` })
      const { fetchMock } = monitor(200)
      await reportJobRun("dsar-export", "ok")
      await reportJobRun("dsar-export", "fail", "threw")
      expect(fetchMock).not.toHaveBeenCalled()
      // The setting names a job no monitor can watch. It is said, by
      // name, when the setting is first read for a scheduled job.
      await reportJobRun("keep-alive", "ok")
      expect(fetchMock).not.toHaveBeenCalled()
      expect(logged()).toContain('"dsar-export"')
      expect(logged()).not.toContain(SECRET)
    })
  })

  describe("what it says", () => {
    beforeEach(() => configure({ "keep-alive": `${ADDRESS}/${SECRET}` }))

    it("says a failure at the address's /fail, with the reason and nothing else", async () => {
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "fail", "status 500")
      await reportJobRun("keep-alive", "fail", "threw")
      await reportJobRun("keep-alive", "fail")
      expect(calls).toEqual([
        {
          url: `${ADDRESS}/${SECRET}/fail`,
          method: "POST",
          body: "status 500",
        },
        { url: `${ADDRESS}/${SECRET}/fail`, method: "POST", body: "threw" },
        { url: `${ADDRESS}/${SECRET}/fail`, method: "POST", body: "failed" },
      ])
    })

    it("ends on done when a failed run is retried and succeeds", async () => {
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "fail", "status 500")
      await reportJobRun("keep-alive", "fail", "status 500")
      await reportJobRun("keep-alive", "ok")
      expect(calls.map((call) => call.url)).toEqual([
        `${ADDRESS}/${SECRET}/fail`,
        `${ADDRESS}/${SECRET}/fail`,
        `${ADDRESS}/${SECRET}`,
      ])
    })

    it("reports a run delivered twice, twice: it keeps no state", async () => {
      const { calls } = monitor(200)
      await Promise.all([
        reportJobRun("keep-alive", "ok"),
        reportJobRun("keep-alive", "ok"),
      ])
      expect(calls).toHaveLength(2)
    })
  })

  describe("when the monitor is in trouble", () => {
    beforeEach(() => configure({ "keep-alive": `${ADDRESS}/${SECRET}` }))

    it("tries once more when it cannot be reached, then gives up quietly", async () => {
      const { fetchMock } = monitor("down")
      await expect(reportJobRun("keep-alive", "ok")).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(logged()).toContain('"keep-alive" could not report ok')
      expect(logged()).toContain("could not be reached")
      expect(logged()).not.toContain(SECRET)
    })

    it("reports on the second try when the first is lost", async () => {
      const { fetchMock } = monitor("down", 200)
      await reportJobRun("keep-alive", "ok")
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(errors).not.toHaveBeenCalled()
    })

    it("tries once more on a 5xx answer", async () => {
      const { fetchMock } = monitor(503, 200)
      await reportJobRun("keep-alive", "ok")
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(errors).not.toHaveBeenCalled()
    })

    it("does not ask again when the address is wrong (404), and says so without it", async () => {
      const { fetchMock } = monitor(404)
      await expect(reportJobRun("keep-alive", "ok")).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledOnce()
      expect(logged()).toContain("the monitor answered 404")
      expect(logged()).not.toContain(SECRET)
      expect(logged()).not.toContain(ADDRESS)
    })

    it("stops waiting on a monitor that never answers, within ten seconds", async () => {
      // The time limit of each try, without waiting for it: the limit is
      // read, and a signal whose time is already up is given back.
      const limits: number[] = []
      vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
        limits.push(ms)
        return AbortSignal.abort(new DOMException("timed out", "TimeoutError"))
      })
      const { fetchMock } = monitor("hangs")
      await expect(reportJobRun("keep-alive", "ok")).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(limits).toHaveLength(2)
      expect(limits.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(
        10_000
      )
      expect(logged()).toContain("did not answer in time")
      expect(logged()).not.toContain(SECRET)
    })
  })

  describe("a setting that is wrong", () => {
    it.each([
      ["not JSON", "https://monitor.example/abc"],
      ["a list", '["https://monitor.example/abc"]'],
      ["a text", '"https://monitor.example/abc"'],
      ["null", "null"],
    ])(
      "reports nothing when it is %s, and says why without it",
      async (_what, raw) => {
        configure(raw)
        const { fetchMock } = monitor(200)
        await reportJobRun("keep-alive", "ok")
        await reportJobRun("keep-alive", "ok")
        expect(fetchMock).not.toHaveBeenCalled()
        // Said once, not on every run.
        expect(errors).toHaveBeenCalledOnce()
        expect(logged()).toContain("BETTERSTACK_HEARTBEAT_URLS")
        expect(logged()).not.toContain("monitor.example")
      }
    )

    it("leaves out an address that is not https, and keeps the others", async () => {
      configure({
        "keep-alive": `http://monitor.example/${SECRET}`,
        "booking-probes": 42,
        "tick-hourly": `${ADDRESS}/${SECRET}`,
      })
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      await reportJobRun("booking-probes", "ok")
      await reportJobRun("tick-hourly", "ok")
      expect(calls.map((call) => call.url)).toEqual([`${ADDRESS}/${SECRET}`])
      expect(logged()).toContain('"keep-alive"')
      expect(logged()).toContain('"booking-probes"')
      expect(logged()).not.toContain(SECRET)
    })

    it("ignores a name that is not a job, without printing it", async () => {
      // An address put where the name goes must not reach the log.
      configure({
        [`${ADDRESS}/${SECRET}`]: "keep-alive",
        "not-a-job": `${ADDRESS}/${SECRET}`,
      })
      const { fetchMock } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      expect(fetchMock).not.toHaveBeenCalled()
      expect(logged()).toContain("2 name(s) that are not jobs")
      expect(logged()).not.toContain(SECRET)
      expect(logged()).not.toContain("monitor.example")
    })

    it.each([
      ["a ? part", `${ADDRESS}/${SECRET}?team=1`],
      ["a # part", `${ADDRESS}/${SECRET}#top`],
      ["a name and password", `https://user:pass@monitor.example/${SECRET}`],
      ["no https", `ftp://monitor.example/${SECRET}`],
      ["/fail already at its end", `${ADDRESS}/${SECRET}/fail`],
      ["an exit code at its end", `${ADDRESS}/${SECRET}/1`],
      ["no path", "https://monitor.example"],
      ["no address at all", "keep-alive"],
    ])(
      "does not use an address with %s: /fail could not follow it",
      async (_what, address) => {
        configure({ "keep-alive": address })
        const { fetchMock } = monitor(200)
        await reportJobRun("keep-alive", "fail", "status 500")
        await reportJobRun("keep-alive", "ok")
        expect(fetchMock).not.toHaveBeenCalled()
        expect(logged()).toContain('"keep-alive"')
        expect(logged()).not.toContain(SECRET)
      }
    )

    it("lets no two jobs share an address: the one that runs would hide the other", async () => {
      configure({
        "keep-alive": `${ADDRESS}/${SECRET}`,
        "booking-probes": `${ADDRESS}/${SECRET}/`,
        "tick-hourly": `${ADDRESS}/its-own`,
      })
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      await reportJobRun("booking-probes", "ok")
      await reportJobRun("tick-hourly", "ok")
      expect(calls.map((call) => call.url)).toEqual([`${ADDRESS}/its-own`])
      expect(logged()).toContain('"keep-alive" and "booking-probes"')
      expect(logged()).not.toContain(SECRET)
    })

    it("is not fooled by names every object has", async () => {
      configure(
        `{"__proto__":"${ADDRESS}/a","constructor":"${ADDRESS}/b","toString":"${ADDRESS}/c"}`
      )
      const { fetchMock } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      expect(fetchMock).not.toHaveBeenCalled()
      expect(({} as Record<string, unknown>).keep).toBeUndefined()
    })

    it("reads the setting again when it changes", async () => {
      configure({ "keep-alive": `${ADDRESS}/one` })
      const { calls } = monitor(200)
      await reportJobRun("keep-alive", "ok")
      configure({ "keep-alive": `${ADDRESS}/two` })
      await reportJobRun("keep-alive", "ok")
      expect(calls.map((call) => call.url)).toEqual([
        `${ADDRESS}/one`,
        `${ADDRESS}/two`,
      ])
    })
  })
})
