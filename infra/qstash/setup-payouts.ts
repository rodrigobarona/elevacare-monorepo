/**
 * QStash schedules for the payout engine (Phase 06.2).
 *
 * Crons are UTC. 05:00 UTC is 05:00 Europe/Lisbon in winter (WET) and
 * 06:00 Europe/Lisbon in summer (WEST). Schedules stay on fixed UTC.
 *
 * Usage:
 *   pnpm qstash:setup:payouts
 *   pnpm qstash:setup:payouts -- --dry-run
 *
 * Do not apply against live QStash unless an operator asks.
 */
import { PAYOUT_SCHEDULES } from "./payout-schedules"
import { isDryRun, registerSchedule } from "./register-schedule"

const dryRun = isDryRun()

async function main() {
  for (const spec of PAYOUT_SCHEDULES) {
    await registerSchedule(spec, { dryRun })
  }
}

main().catch((err) => {
  console.error("[qstash:payouts] Failed:", err)
  process.exit(1)
})
