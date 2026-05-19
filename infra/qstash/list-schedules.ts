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
  "/workos/sync",
  "/workflows/audit-outbox-drainer",
  "/workflows/stripe-stuck-events",
] as const

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

  // Cross-check expected paths. Match by suffix so any host (staging,
  // production, custom domain) hits the same expectation.
  console.log(`\n=== Expected schedules check ===`)
  for (const path of EXPECTED_PATHS) {
    const match = schedules.find((s: Schedule) => s.destination.endsWith(path))
    if (match) {
      console.log(
        `  PRESENT  ${path}  →  ${match.destination}  (cron ${match.cron})`
      )
    } else {
      console.log(`  MISSING  ${path}`)
    }
  }
}

main().catch((err) => {
  console.error("[qstash:list] Failed:", err)
  process.exit(1)
})
