/**
 * QStash schedule for the audit outbox drainer.
 *
 * Triggers `POST /workflows/audit-outbox-drainer` twice daily (06:00 +
 * 18:00 UTC). The drainer ships rows from the main DB's `audit_outbox`
 * table to the append-only `audit_events` table in the separate audit
 * Neon project (per `@eleva/audit` README).
 *
 * Auth: bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:audit-drainer
 *   pnpm qstash:setup:audit-drainer -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"

async function main() {
  await registerSchedule(
    {
      name: "Audit outbox drainer",
      path: "/workflows/audit-outbox-drainer",
      cron: "0 6,18 * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Ship audit_outbox rows to the audit Neon project (06:00 + 18:00 UTC)",
    },
    { dryRun: isDryRun() }
  )
}

main().catch((err) => {
  console.error("[qstash:audit-drainer] Failed:", err)
  process.exit(1)
})
