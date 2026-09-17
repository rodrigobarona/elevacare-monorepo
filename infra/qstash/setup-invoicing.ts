/**
 * QStash schedule for the expert invoicing slow-stage retry.
 *
 * Triggers `POST /workflows/invoicing-retry` every 30 minutes. The
 * worker re-dispatches `failed` expert invoices without opening the
 * TOConline v1 issuance gate (no FT POST / no Comunicar TEST).
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

async function main() {
  await registerSchedule(INVOICING_RETRY_SCHEDULE, { dryRun: isDryRun() })
}

main().catch((err) => {
  console.error("[qstash:invoicing] Failed:", err)
  process.exit(1)
})
