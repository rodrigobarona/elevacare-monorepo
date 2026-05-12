#!/usr/bin/env tsx
/**
 * Creates or updates the QStash schedule that triggers WorkOS Events API
 * polling every 5 minutes.
 *
 * Usage:
 *   pnpm --filter @eleva/api run setup:qstash
 *   pnpm --filter @eleva/api run setup:qstash -- --dry-run
 *   API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash
 *
 * Reads QSTASH_TOKEN and QSTASH_URL from ../../.env.local (or the
 * environment if running in CI).
 */
import { Client } from "@upstash/qstash"

const SCHEDULE_CRON = "*/5 * * * *"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const token = process.env.QSTASH_TOKEN
  const baseUrl = process.env.QSTASH_URL

  if (!token) {
    console.error("QSTASH_TOKEN is not set")
    process.exit(1)
  }

  const apiBaseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3002"
  const destination = `${apiBaseUrl}/workos/sync`

  console.log("QStash Schedule Setup")
  console.log("=====================")
  console.log(`  Destination: ${destination}`)
  console.log(`  Cron:        ${SCHEDULE_CRON}`)
  console.log(`  Retries:     3`)
  if (dryRun) console.log(`  Mode:        DRY RUN (no changes)`)
  console.log("")

  if (dryRun) {
    console.log(
      "Dry run complete. Use without --dry-run to create the schedule."
    )
    return
  }

  const client = new Client({ baseUrl, token })

  const existingSchedules = await client.schedules.list()
  const existing = existingSchedules.find((s) => s.destination === destination)

  if (existing) {
    console.log(`Found existing schedule: ${existing.scheduleId}`)
    console.log("  Removing old schedule...")
    await client.schedules.delete(existing.scheduleId)
  }

  const schedule = await client.schedules.create({
    destination,
    cron: SCHEDULE_CRON,
    retries: 3,
  })

  console.log(`Created schedule: ${schedule.scheduleId}`)
  console.log("")
  console.log(
    "Done! The schedule will POST to the sync endpoint every 5 minutes."
  )
}

main().catch((err) => {
  console.error("Failed to set up QStash schedule:", err)
  process.exit(1)
})
