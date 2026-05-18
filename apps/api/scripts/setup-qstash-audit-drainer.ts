#!/usr/bin/env tsx
/**
 * Creates or updates the QStash schedule that triggers the audit outbox
 * drainer twice daily (06:00 and 18:00 UTC).
 *
 * Usage:
 *   API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:audit
 *   API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:audit -- --dry-run
 *
 * API_BASE_URL must be a publicly reachable URL (QStash cannot call localhost).
 *
 * Reads QSTASH_TOKEN, QSTASH_URL, and WORKFLOWS_DRAIN_SECRET from
 * ../../.env.local (or the environment if running in CI).
 */
import { Client } from "@upstash/qstash"

const SCHEDULE_CRON = "0 6,18 * * *"

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
        "  API_BASE_URL=https://api.eleva.care pnpm --filter @eleva/api run setup:qstash:audit"
    )
    process.exit(1)
  }
  const destination = `${apiBaseUrl}/workflows/audit-outbox-drainer`

  console.log("QStash Audit Drainer Schedule Setup")
  console.log("====================================")
  console.log(`  Destination: ${destination}`)
  console.log(`  Cron:        ${SCHEDULE_CRON} (06:00 + 18:00 UTC)`)
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
    headers: {
      Authorization: `Bearer ${drainSecret}`,
    },
  })

  console.log(`Created schedule: ${schedule.scheduleId}`)
  console.log("")
  console.log("Done! The drainer will run at 06:00 and 18:00 UTC daily.")
}

main().catch((err) => {
  console.error("Failed to set up QStash audit drainer schedule:", err)
  process.exit(1)
})
