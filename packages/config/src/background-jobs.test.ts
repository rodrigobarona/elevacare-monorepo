import { describe, expect, it } from "vitest"
import {
  BACKGROUND_JOBS,
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

  it("says why each on-demand job has no monitor", () => {
    for (const reason of Object.values(ON_DEMAND_JOBS)) {
      expect(reason.length).toBeGreaterThan(20)
    }
  })
})
