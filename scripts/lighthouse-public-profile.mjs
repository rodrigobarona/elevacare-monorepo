#!/usr/bin/env node
/**
 * Opt-in mobile Lighthouse gate for the public expert profile (Phase 04 AC).
 * Usage: LIGHTHOUSE_URL=https://eleva.care/fisiomota pnpm lighthouse:public-profile
 * Local: start apps/web on :3000 first, then LIGHTHOUSE_URL=http://localhost:3000/fisiomota ...
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const url =
  process.env.LIGHTHOUSE_URL?.trim() || "http://127.0.0.1:3000/fisiomota"
const minScore = Number(process.env.LIGHTHOUSE_MIN_PERFORMANCE ?? "90")
const outDir = mkdtempSync(join(tmpdir(), "eleva-lh-"))

try {
  const run = spawnSync(
    "pnpm",
    [
      "exec",
      "lighthouse",
      url,
      "--preset=mobile",
      "--quiet",
      "--chrome-flags=--headless=new",
      `--output=json`,
      `--output-path=${join(outDir, "report.json")}`,
      "--only-categories=performance",
    ],
    { stdio: "inherit", encoding: "utf8" }
  )
  if (run.status !== 0) {
    process.exit(run.status ?? 1)
  }

  const report = JSON.parse(readFileSync(join(outDir, "report.json"), "utf8"))
  const score = report.categories?.performance?.score
  const pct = score == null ? null : Math.round(score * 100)
  if (pct == null) {
    console.error("Lighthouse report missing performance score")
    process.exit(1)
  }
  console.log(`Lighthouse performance (mobile) for ${url}: ${pct}`)
  if (pct < minScore) {
    console.error(`Below minimum ${minScore}`)
    process.exit(1)
  }
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
