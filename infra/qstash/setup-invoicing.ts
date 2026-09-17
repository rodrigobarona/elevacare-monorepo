/**
 * QStash schedules for closed-gate expert invoicing.
 *
 * - `POST /workflows/invoicing-retry` every 30 minutes
 * - `POST /workflows/stripe-toconline-reconciliation` monthly (1st 04:00 UTC)
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

export const INVOICING_RETRY_SCHEDULE = {
  name: "Invoicing retry",
  path: "/workflows/invoicing-retry",
  cron: "*/30 * * * *",
  retries: 3,
  requireBearer: true,
  description:
    "Retry failed expert invoices every 30 min (issuance gate stays closed)",
} as const

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
  await registerSchedule(INVOICING_RETRY_SCHEDULE, { dryRun })
  await registerSchedule(STRIPE_TOCONLINE_RECONCILIATION_SCHEDULE, {
    dryRun,
  })
}

main().catch((err) => {
  console.error("[qstash:invoicing] Failed:", err)
  process.exit(1)
})
