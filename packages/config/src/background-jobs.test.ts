import { describe, expect, it } from "vitest"
import {
  BACKGROUND_JOBS,
  isOnDemandJob,
  isScheduledJob,
  ON_DEMAND_JOBS,
} from "./background-jobs"

const jobs = Object.entries(BACKGROUND_JOBS)

describe("the list of background jobs", () => {
  it("names each job once, scheduled or on demand", () => {
    const scheduled = Object.keys(BACKGROUND_JOBS)
    const onDemand = Object.keys(ON_DEMAND_JOBS)
    expect(scheduled.filter((name) => onDemand.includes(name))).toEqual([])
    for (const name of [...scheduled, ...onDemand]) {
      expect(name, name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
    expect(isScheduledJob("keep-alive")).toBe(true)
    expect(isScheduledJob("dsar-export")).toBe(false)
    expect(isScheduledJob("toString")).toBe(false)
  })

  it.each(jobs)("%s has a period a monitor accepts", (_name, job) => {
    // Better Stack: at least 30 seconds, less than a year.
    expect(job.periodSeconds).toBeGreaterThanOrEqual(30)
    expect(job.periodSeconds).toBeLessThan(365 * 24 * 60 * 60)
    expect(Number.isInteger(job.periodSeconds)).toBe(true)
    expect(Number.isInteger(job.graceSeconds)).toBe(true)
    expect(job.schedule.split(" ")).toHaveLength(5)
    expect(job.path).toMatch(/^\/(workflows|cron)\//)
  })

  it.each(jobs.filter(([, job]) => job.trigger !== "qstash"))(
    "%s waits for at least one missed run: Vercel Cron may skip one",
    (_name, job) => {
      expect(job.graceSeconds).toBeGreaterThanOrEqual(job.periodSeconds)
    }
  )

  it.each(jobs.filter(([, job]) => job.trigger === "qstash"))(
    "%s waits out the three QStash retries (about 33 minutes)",
    (_name, job) => {
      expect(job.graceSeconds).toBeGreaterThanOrEqual(35 * 60)
    }
  )

  /** How often a cron expression of the kinds used here fires, in seconds. */
  function everySeconds(schedule: string): number {
    const [minute, hour, day, month, weekday] = schedule.split(" ")
    expect([month, weekday], schedule).toEqual(["*", "*"])
    const step = (field: string) => Number(field.replace("*/", ""))
    if (day !== "*") return 31 * 24 * 60 * 60
    if (hour === "*") {
      if (minute === "*") return 60
      return minute!.startsWith("*/") ? step(minute!) * 60 : 60 * 60
    }
    return hour!.startsWith("*/") ? step(hour!) * 60 * 60 : 24 * 60 * 60
  }

  it.each(jobs)(
    "%s is expected as often as its schedule fires",
    (_name, job) => {
      // The monitor is built from the period: a period that does not
      // follow the schedule is a job nobody notices is late.
      expect(job.periodSeconds).toBe(everySeconds(job.schedule))
    }
  )

  it.each(jobs)(
    "%s does not run more often than once an hour",
    (_name, job) => {
      // The rule of this list. The database sleeps when nothing asks it
      // anything, and every job here asks it something on every run: one
      // job a minute keeps it awake around the clock, which in November
      // 2026 used a month's allowance in sixteen days and stopped
      // production. Work that cannot wait an hour is started when it is
      // created or falls due, not polled for (`apps/api/src/lib/run-job-at.ts`).
      expect(job.periodSeconds).toBeGreaterThanOrEqual(60 * 60)
      expect(everySeconds(job.schedule)).toBeGreaterThanOrEqual(60 * 60)
    }
  )

  it("starts on the hour whatever runs every hour or two, to share one waking", () => {
    for (const [name, job] of jobs) {
      if (job.periodSeconds > 2 * 60 * 60) continue
      expect(job.schedule.split(" ")[0], name).toBe("0")
    }
  })

  it("reads the schedules it is checked against", () => {
    expect(everySeconds("* * * * *")).toBe(60)
    expect(everySeconds("*/10 * * * *")).toBe(600)
    expect(everySeconds("0 * * * *")).toBe(3600)
    expect(everySeconds("0 */2 * * *")).toBe(7200)
    expect(everySeconds("15 6 * * *")).toBe(86400)
    expect(everySeconds("0 4 1 * *")).toBe(31 * 86400)
  })

  it("marks the one schedule that is not registered yet", () => {
    const waiting = jobs
      .filter(([, job]) => "notRegisteredUntil" in job)
      .map(([name]) => name)
    expect(waiting).toEqual(["retention-sweep"])
  })

  it("puts every tick job under the tick it runs in", () => {
    for (const [name, job] of jobs) {
      if (job.trigger !== "tick") continue
      const tick = BACKGROUND_JOBS[`tick-${job.cadence}`]
      expect([job.schedule, job.periodSeconds, job.graceSeconds], name).toEqual(
        [tick.schedule, tick.periodSeconds, tick.graceSeconds]
      )
    }
    expect(isOnDemandJob("dsar-export")).toBe(true)
    expect(isOnDemandJob("keep-alive")).toBe(false)
    expect(isOnDemandJob("constructor")).toBe(false)
  })

  it("says why each on-demand job has no monitor", () => {
    for (const reason of Object.values(ON_DEMAND_JOBS)) {
      expect(reason.length).toBeGreaterThan(20)
    }
  })
})
