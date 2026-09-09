/**
 * QStash schedule for the domain-events publisher.
 *
 * Triggers `POST /workflows/domain-events-publisher` every minute.
 * Auth: QStash signature when signing keys are present, otherwise
 * bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:domain-events
 *   pnpm qstash:setup:domain-events -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"
import { DOMAIN_EVENTS_PUBLISHER_SCHEDULE } from "./domain-events-schedule"

async function main() {
  await registerSchedule(DOMAIN_EVENTS_PUBLISHER_SCHEDULE, {
    dryRun: isDryRun(),
  })
}

main().catch((err) => {
  console.error("[qstash:domain-events] Failed:", err)
  process.exit(1)
})
