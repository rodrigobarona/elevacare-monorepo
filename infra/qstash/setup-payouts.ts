/**
 * QStash schedules for the payout engine (Phase 06.2).
 *
 * Crons are UTC. Lisbon is UTC+0 in winter and UTC+1 in summer, so
 * 05:00 UTC is 06:00 Europe/Lisbon during WEST and 06:00 UTC/WET in winter.
 *
 * Usage:
 *   pnpm qstash:setup:payouts
 *   pnpm qstash:setup:payouts -- --dry-run
 *
 * Do not apply against live QStash unless an operator asks.
 */
import { isDryRun, registerSchedule } from "./register-schedule"

const dryRun = isDryRun()

async function main() {
  await registerSchedule(
    {
      name: "Process expert transfers",
      path: "/workflows/process-expert-transfers",
      cron: "0 */2 * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Create Stripe Transfers for scheduled eligible payouts (every 2h)",
    },
    { dryRun }
  )

  await registerSchedule(
    {
      name: "Process pending payouts",
      path: "/workflows/process-pending-payouts",
      cron: "0 5 * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Promote pending payouts to scheduled at 05:00 UTC (~06:00 Europe/Lisbon in WEST)",
    },
    { dryRun }
  )

  await registerSchedule(
    {
      name: "Check upcoming payouts",
      path: "/workflows/check-upcoming-payouts",
      cron: "0 7 * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Alert on payouts becoming eligible within 48h at 07:00 UTC (~08:00 Europe/Lisbon in WEST)",
    },
    { dryRun }
  )
}

main().catch((err) => {
  console.error("[qstash:payouts] Failed:", err)
  process.exit(1)
})
