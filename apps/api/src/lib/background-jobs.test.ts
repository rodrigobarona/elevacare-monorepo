import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
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

describe("every background job reports its run", () => {
  it("finds the job routes, and no route it does not know", () => {
    // The 20 workflow routes and the 2 cron routes there are today.
    expect(Object.keys(ROUTES).length).toBeGreaterThanOrEqual(22)
    // Every route file under the two folders, however deep: one job per
    // folder, and the tick. A route put anywhere else is not checked by
    // the tests below, so it fails here.
    const found: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/^route\.(ts|tsx|js|mjs)$/.test(name)) found.push(path)
      }
    }
    walk(join(app, "workflows"))
    walk(join(app, "cron"))
    expect(found.sort()).toEqual([...Object.values(ROUTES), TICK_ROUTE].sort())
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
      // No handler exported another way (a list of exports, or another
      // file's), and no second way to report.
      expect(source, `${name}: export { ... } or export *`).not.toMatch(
        /export\s*(\{|\*)/
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
    expect(source).toMatch(
      /reportJobRun\(`tick-\$\{cadence\}`, "fail", "threw"\)/
    )
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
    const packages = readdirSync(join(repo, "packages")).filter((name) =>
      existsSync(join(repo, "packages", name, "src"))
    )
    expect(packages.length).toBeGreaterThan(20)
    for (const name of packages) walk(join(repo, "packages", name, "src"))
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

  it("has the jobs of every tick: the table does not compile otherwise", () => {
    // `satisfies` in workflow-ticks.ts ties the table to the list, job by
    // job and tick by tick; `tsc` is what fails. This only says the tie
    // is still there.
    const source = read(api, "src", "lib", "workflow-ticks.ts")
    expect(source).toMatch(
      /as const satisfies \{\s*\[Cadence in TickCadence\]: Record<\s*JobsInTick<Cadence>,/
    )
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
    // Every schedule in the scripts is a path with its cron beside it.
    expect(registered.length).toBe((source.match(/\bcron: "/g) ?? []).length)
    const listed = Object.fromEntries(
      scheduled
        .filter(([, job]) => job.trigger === "qstash")
        .map(([, job]) => [job.path, job.schedule])
    )
    // Each one, as often as it is written: two scripts that register the
    // same job must both agree with the list.
    for (const { path, schedule } of registered) {
      expect(listed[path], `${path} in infra/qstash`).toBe(schedule)
    }
    expect([...new Set(registered.map((one) => one.path))].sort()).toEqual(
      Object.keys(listed).sort()
    )
  })
})
