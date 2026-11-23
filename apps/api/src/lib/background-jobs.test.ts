import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { BACKGROUND_JOBS, ON_DEMAND_JOBS } from "@eleva/config/background-jobs"

/**
 * Every background job reports that it ran (slice 13.18). This reads the
 * route folders, the schedules and the list of jobs, and fails when they
 * disagree: a new job route that does not report, a job in the list with
 * no route, or a schedule that changed in one place only.
 */

const api = join(import.meta.dirname, "..", "..")
const repo = join(api, "..", "..")
const app = join(api, "src", "app")
const read = (...path: string[]) => readFileSync(join(...path), "utf8")

const folders = (dir: string) =>
  readdirSync(join(app, dir)).filter((name) =>
    statSync(join(app, dir, name)).isDirectory()
  )

/** Every job route, by the name it must report under. */
const ROUTES: Record<string, string> = Object.fromEntries([
  ...folders("workflows")
    .filter((name) => name !== "tick")
    .map((name) => [name, join(app, "workflows", name, "route.ts")]),
  ...folders("cron").map((name) => [name, join(app, "cron", name, "route.ts")]),
])
const TICK_ROUTE = join(app, "workflows", "tick", "[cadence]", "route.ts")

const scheduled = Object.entries(BACKGROUND_JOBS)
const ticks = scheduled.filter(([name]) => name.startsWith("tick-"))

describe("every background job reports its run", () => {
  it("finds the job routes", () => {
    // The 20 workflow routes and the 2 cron routes there are today.
    expect(Object.keys(ROUTES).length).toBeGreaterThanOrEqual(22)
  })

  it.each(Object.keys(ROUTES))("%s is in the list of jobs", (name) => {
    expect(
      name in BACKGROUND_JOBS || name in ON_DEMAND_JOBS,
      `${name} has a route and is in neither BACKGROUND_JOBS nor ON_DEMAND_JOBS (@eleva/config/background-jobs)`
    ).toBe(true)
  })

  it.each(Object.entries(ROUTES))(
    "%s exports its handler through reportedJob, under its own name",
    (name, file) => {
      const source = read(file)
      const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD"
      // Every handler Next.js serves from this file. OPTIONS is not a run.
      const handlers = [
        ...source.matchAll(
          new RegExp(
            `export\\s+(?:async\\s+function|function|const)\\s+(${METHODS})\\b`,
            "g"
          )
        ),
      ]
      const wrapped = [
        ...source.matchAll(
          new RegExp(
            `export const (${METHODS}) = reportedJob\\(\\s*"${name}"`,
            "g"
          )
        ),
      ]
      expect(handlers.length, `${name}: a handler`).toBeGreaterThan(0)
      expect(
        wrapped.map((match) => match[1]),
        `${name}: every handler is reportedJob("${name}", ...)`
      ).toEqual(handlers.map((match) => match[1]))
      // No handler exported another way, and no second way to report.
      expect(source).not.toMatch(
        new RegExp(`export\\s*\\{[^}]*\\bas\\s+(${METHODS})\\b`)
      )
      expect(source).not.toMatch(/\breportJobRun\(|\bheartbeat\(/)
    }
  )

  it("has a route for every job in the list", () => {
    const listed = [
      ...scheduled
        .map(([name]) => name)
        .filter((name) => !name.startsWith("tick-")),
      ...Object.keys(ON_DEMAND_JOBS),
    ]
    expect(listed.sort()).toEqual(Object.keys(ROUTES).sort())
    const cron = new Set(folders("cron"))
    for (const [name, job] of scheduled) {
      const path = name.startsWith("tick-")
        ? `/workflows/tick/${name.replace("tick-", "")}`
        : `/${cron.has(name) ? "cron" : "workflows"}/${name}`
      expect(job.path, name).toBe(path)
    }
  })

  it("the tick reports for itself, under the cadence it ran", () => {
    const source = read(TICK_ROUTE)
    expect(source).toMatch(/reportJobRun\(`tick-\$\{cadence\}`, "ok"\)/)
    expect(source).not.toMatch(/\bheartbeat\(/)
  })

  it("no job says it ran by any other way", () => {
    // The old helper, and a report sent from inside a domain function.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name === "dist")
          continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const source = read(path)
          const allowed =
            path === TICK_ROUTE ||
            path.endsWith(join("lib", "reported-job.ts")) ||
            path.endsWith(join("observability", "src", "job-runs.ts")) ||
            path.endsWith(join("observability", "src", "index.ts"))
          if (/\bheartbeat\(/.test(source))
            offenders.push(`${path}: heartbeat(`)
          if (!allowed && /\breportJobRun\b/.test(source)) {
            offenders.push(`${path}: reportJobRun`)
          }
        }
      }
    }
    walk(join(api, "src"))
    for (const name of [
      "workflows",
      "observability",
      "scheduling",
      "billing",
      "accounting",
      "notifications",
    ]) {
      walk(join(repo, "packages", name, "src"))
    }
    expect(offenders).toEqual([])
  })
})

describe("the list of jobs agrees with the schedules", () => {
  it("has the Vercel Cron schedules of apps/api/vercel.json, and no other", () => {
    const { crons } = JSON.parse(read(api, "vercel.json")) as {
      crons: { path: string; schedule: string }[]
    }
    const listed = scheduled
      .filter(([, job]) => job.trigger === "vercel-cron")
      .map(([, job]) => ({ path: job.path, schedule: job.schedule }))
    const byPath = (a: { path: string }, b: { path: string }) =>
      a.path.localeCompare(b.path)
    expect(listed.sort(byPath)).toEqual([...crons].sort(byPath))
  })

  it("has every job of every tick, at the tick's own cadence", () => {
    // Read as text: importing the table would load every job's route.
    const source = read(api, "src", "lib", "workflow-ticks.ts")
    const table = source.slice(source.indexOf("export const WORKFLOW_TICKS"))
    const inTicks: Record<string, string> = {}
    for (const [, cadence, body] of table.matchAll(
      /^ {2}"?([\w]+)"?: \{\n([\s\S]*?)^ {2}\},/gm
    )) {
      for (const [, job] of body!.matchAll(/^ {4}"([\w-]+)":/gm)) {
        inTicks[job!] = cadence!
      }
    }
    expect(Object.keys(inTicks).length).toBeGreaterThanOrEqual(12)

    const listed = Object.fromEntries(
      scheduled
        .filter(([, job]) => job.trigger === "tick")
        .map(([name, job]) => {
          const tick = ticks.find(([, one]) => one.schedule === job.schedule)
          return [name, tick?.[0].replace("tick-", "")]
        })
    )
    expect(listed).toEqual(inTicks)
    // A job in a tick is expected as often as the tick runs.
    for (const [name, cadence] of Object.entries(inTicks)) {
      const job = BACKGROUND_JOBS[name as keyof typeof BACKGROUND_JOBS]
      const tick =
        BACKGROUND_JOBS[`tick-${cadence}` as keyof typeof BACKGROUND_JOBS]
      expect(
        [job.periodSeconds, job.graceSeconds],
        `${name} in the ${cadence} tick`
      ).toEqual([tick.periodSeconds, tick.graceSeconds])
    }
  })

  it("has the QStash schedules of infra/qstash, and no other", () => {
    const qstash = join(repo, "infra", "qstash")
    const source = readdirSync(qstash)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => read(qstash, name))
      .join("\n")
    const registered = [
      ...source.matchAll(/path: "(\/workflows\/[\w-]+)",\s*cron: "([^"]+)"/g),
    ].map(([, path, schedule]) => ({ path: path!, schedule: schedule! }))
    const unique = [
      ...new Map(registered.map((one) => [one.path, one])).values(),
    ]
    const listed = scheduled
      .filter(([, job]) => job.trigger === "qstash")
      .map(([, job]) => ({ path: job.path, schedule: job.schedule }))
    const byPath = (a: { path: string }, b: { path: string }) =>
      a.path.localeCompare(b.path)
    expect(unique.length).toBeGreaterThanOrEqual(5)
    expect(listed.sort(byPath)).toEqual(unique.sort(byPath))
  })
})
