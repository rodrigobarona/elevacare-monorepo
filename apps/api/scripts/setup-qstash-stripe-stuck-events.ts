#!/usr/bin/env tsx
/**
 * Creates or updates the QStash schedule that triggers the Stripe
 * stuck-events detector every 10 minutes.
 *
 * Usage:
 *   API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:stripe-stuck
 *   API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:stripe-stuck -- --dry-run
 *
 * API_BASE_URL must be a publicly reachable URL (QStash cannot call localhost).
 *
 * Reads QSTASH_TOKEN, QSTASH_URL, and WORKFLOWS_DRAIN_SECRET from
 * ../../.env.local (or the environment if running in CI).
 */
import { Client } from "@upstash/qstash"

const SCHEDULE_CRON = "*/10 * * * *"

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const token = process.env.QSTASH_TOKEN
  const baseUrl = process.env.QSTASH_URL
  const drainSecret = process.env.WORKFLOWS_DRAIN_SECRET

  if (!token) {
    console.error("QSTASH_TOKEN is not set")
    process.exit(1)
  }

  if (!drainSecret) {
    console.error("WORKFLOWS_DRAIN_SECRET is not set")
    process.exit(1)
  }

  const apiBaseUrl = process.env.API_BASE_URL
  if (
    !apiBaseUrl ||
    apiBaseUrl.includes("localhost") ||
    apiBaseUrl.includes("127.0.0.1")
  ) {
    console.error(
      "API_BASE_URL must be set to a publicly reachable URL.\n" +
        "QStash is a cloud service and cannot call localhost.\n\n" +
        "Example:\n" +
        "  API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:stripe-stuck"
    )
    process.exit(1)
  }
  const destination = `${apiBaseUrl.replace(/\/+$/, "")}/workflows/stripe-stuck-events`

  console.log("QStash Stripe Stuck-Events Schedule Setup")
  console.log("==========================================")
  console.log(`  Destination: ${destination}`)
  console.log(`  Cron:        ${SCHEDULE_CRON} (every 10 minutes)`)
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
  const matches = existingSchedules.filter((s) => s.destination === destination)

  for (const match of matches) {
    console.log(`Found existing schedule: ${match.scheduleId}`)
    console.log("  Removing...")
    await client.schedules.delete(match.scheduleId)
  }

  const schedule = await client.schedules.create({
    destination,
    cron: SCHEDULE_CRON,
    retries: 3,
    headers: {
      Authorization: `Bearer ${drainSecret}`,
    },
  })

  console.log(`Created schedule: ${schedule.scheduleId}`)
  console.log("")
  console.log(
    "Done! The detector will run every 10 minutes and raise a Sentry\n" +
      "error per stuck stripe_webhook_events row past its threshold."
  )
}

main().catch((err) => {
  console.error("Failed to set up QStash stripe stuck-events schedule:", err)
  process.exit(1)
})
