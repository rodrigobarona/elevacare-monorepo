/**
 * QStash schedule for the Stripe webhook stuck-event detector.
 *
 * Triggers `POST /workflows/stripe-stuck-events` every 10 minutes. The
 * detector scans `stripe_webhook_events` for rows in non-terminal
 * states past their threshold and fires a `Sentry.captureException` per
 * stuck row so on-call sees them within one window.
 *
 * Auth: bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:stripe-stuck
 *   pnpm qstash:setup:stripe-stuck -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"

async function main() {
  await registerSchedule(
    {
      name: "Stripe stuck-event detector",
      path: "/workflows/stripe-stuck-events",
      cron: "*/10 * * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Detect stuck stripe_webhook_events rows and raise Sentry alerts",
    },
    { dryRun: isDryRun() }
  )
}

main().catch((err) => {
  console.error("[qstash:stripe-stuck] Failed:", err)
  process.exit(1)
})
