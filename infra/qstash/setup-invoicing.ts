/**
 * QStash schedules for closed-gate expert invoicing.
 *
 * - `POST /workflows/stripe-toconline-reconciliation` monthly (1st 04:00 UTC)
 *
 * `invoicing-retry` runs inside the hourly tick (`/workflows/tick/hourly`,
 * registered by `setup-all`).
 *
 * Neither job POSTs TOConline commercial sales documents.
 *
 * Auth: bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:invoicing
 *   pnpm qstash:setup:invoicing -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"

export const STRIPE_TOCONLINE_RECONCILIATION_SCHEDULE = {
  name: "Stripe TOConline reconciliation",
  path: "/workflows/stripe-toconline-reconciliation",
  cron: "0 4 1 * *",
  retries: 3,
  requireBearer: true,
  description:
    "Compare Stripe payments vs expert_invoices on the 1st at 04:00 UTC (04:00 WET / 05:00 WEST). Does not POST FTs.",
} as const

async function main() {
  const dryRun = isDryRun()
  await registerSchedule(STRIPE_TOCONLINE_RECONCILIATION_SCHEDULE, {
    dryRun,
  })
}

main().catch((err) => {
  console.error("[qstash:invoicing] Failed:", err)
  process.exit(1)
})
