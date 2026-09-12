/**
 * List every QStash schedule visible to the configured QSTASH_TOKEN.
 *
 * Use this to:
 *  - Audit which schedules are registered against a given environment
 *  - Confirm post-`setup:all` that all expected destinations are present
 *  - Spot orphaned schedules (e.g. left behind after a domain change)
 *
 * Usage:
 *   pnpm qstash:list
 */
import { Client, type Schedule } from "@upstash/qstash"

const EXPECTED_PATHS = [
  "/workflows/audit-outbox-drainer",
  "/workflows/stripe-stuck-events",
  "/workflows/account-deletion-sweep",
  "/workflows/process-expert-transfers",
  "/workflows/process-pending-payouts",
  "/workflows/check-upcoming-payouts",
] as const

function isExpectedDestination(destination: string, path: string): boolean {
  try {
    const url = new URL(destination)
    const isElevaHost =
      url.hostname === "eleva.care" || url.hostname.endsWith(".eleva.care")
    return url.protocol === "https:" && isElevaHost && url.pathname === path
  } catch {
    return false
  }
}

async function main() {
  const token = process.env.QSTASH_TOKEN
  const baseUrl = process.env.QSTASH_URL
  if (!token) {
    console.error("[qstash:list] QSTASH_TOKEN not set")
    process.exit(1)
  }

  const client = new Client({ baseUrl, token })
  const schedules = await client.schedules.list()

  console.log(`\n=== QStash Schedules (${schedules.length}) ===`)
  for (const s of schedules as Schedule[]) {
    console.log(`\n  ${s.scheduleId}`)
    console.log(`    Destination: ${s.destination}`)
    console.log(`    Cron:        ${s.cron}`)
    console.log(`    Retries:     ${s.retries}`)
    console.log(`    Created:     ${new Date(s.createdAt).toISOString()}`)
    if (s.method) console.log(`    Method:      ${s.method}`)
    if (s.header) {
      console.log(`    Headers:     ${Object.keys(s.header).join(", ")}`)
    }
    if (s.isPaused) console.log(`    PAUSED`)
  }

  // Cross-check expected paths. Require an eleva.care host and an exact
  // pathname so a lookalike destination cannot pass as expected.
  console.log(`\n=== Expected schedules check ===`)
  for (const path of EXPECTED_PATHS) {
    const match = schedules.find((s: Schedule) =>
      isExpectedDestination(s.destination, path)
    )
    if (match) {
      console.log(
        `  PRESENT  ${path}  →  ${match.destination}  (cron ${match.cron})`
      )
    } else {
      console.log(`  MISSING  ${path}`)
    }
  }

  const unexpected = schedules.filter(
    (s: Schedule) =>
      !EXPECTED_PATHS.some((path) => isExpectedDestination(s.destination, path))
  )
  if (unexpected.length > 0) {
    console.log(`\n=== Unexpected schedules (delete in Upstash) ===`)
    for (const s of unexpected as Schedule[]) {
      console.log(`  ${s.scheduleId}  →  ${s.destination}`)
    }
  }
}

main().catch((err) => {
  console.error("[qstash:list] Failed:", err)
  process.exit(1)
})
