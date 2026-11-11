/**
 * Provision every QStash schedule the platform needs in one call.
 *
 * Use this when promoting from staging → production, after rotating
 * QStash tokens, or after migrating to a new API base URL.
 *
 * Jobs that run every minute, every 10 minutes or hourly share a tick
 * (`/workflows/tick/{minutely|10min|hourly}`, see
 * `apps/api/src/lib/workflow-ticks.ts`) that Vercel Cron triggers, so they
 * do not use the QStash daily message allowance. QStash keeps the daily,
 * monthly and payout jobs. Per-job and tick schedules left from earlier
 * layouts are removed.
 *
 * The retention sweep deletes data on DPO-owned periods (AUD-028) and is
 * only registered with `--with-retention`, after DPO sign-off.
 *
 * Idempotent: each schedule replaces any existing one for the same
 * destination, so this is safe to re-run.
 *
 * Usage:
 *   API_BASE_URL=https://api.eleva.care pnpm qstash:setup
 *   API_BASE_URL=https://api.eleva.care pnpm qstash:setup -- --dry-run
 *   API_BASE_URL=https://api.eleva.care pnpm qstash:setup -- --with-retention
 */
import {
  isDryRun,
  registerSchedule,
  removeSchedulesFor,
} from "./register-schedule"
import { PAYOUT_SCHEDULES } from "./payout-schedules"

const dryRun = isDryRun()
const withRetention = process.argv.includes("--with-retention")

/** Run by the Vercel Cron ticks; any QStash schedule for them is removed. */
const VERCEL_CRON_PATHS = [
  "/workflows/tick/minutely",
  "/workflows/tick/10min",
  "/workflows/tick/hourly",
  "/workflows/slot-reservation-expiry",
  "/workflows/booking-request-expiry",
  "/workflows/domain-events-publisher",
  "/workflows/video-eject-retry",
  "/workflows/stripe-stuck-events",
  "/workflows/video-room-sweep",
  "/workflows/video-attendance-sweep",
  "/workflows/audit-outbox-drainer",
  "/workflows/account-deletion-sweep",
  "/workflows/crm-follow-up-due",
  "/workflows/invoicing-retry",
] as const

async function main() {
  console.log(
    dryRun
      ? "[qstash:setup:all] DRY RUN — no schedules will be created"
      : "[qstash:setup:all] Provisioning all schedules"
  )

  const removed = await removeSchedulesFor(VERCEL_CRON_PATHS, { dryRun })
  if (removed > 0) {
    console.log(
      `[qstash:setup:all] Removed ${removed} schedules now run by Vercel Cron`
    )
  }

  await registerSchedule(
    {
      name: "Stripe TOConline reconciliation",
      path: "/workflows/stripe-toconline-reconciliation",
      cron: "0 4 1 * *",
      retries: 3,
      requireBearer: true,
      description:
        "Compare Stripe payments vs expert_invoices on the 1st at 04:00 UTC (04:00 WET / 05:00 WEST). Does not POST FTs.",
    },
    { dryRun }
  )

  for (const spec of PAYOUT_SCHEDULES) {
    await registerSchedule(spec, { dryRun })
  }

  if (withRetention) {
    await registerSchedule(
      {
        name: "Retention sweep",
        path: "/workflows/retention-sweep",
        cron: "0 2 * * *",
        retries: 3,
        requireBearer: true,
        description:
          "Daily 10.1d sweep: AI drafts, session documents, notification logs past retention",
      },
      { dryRun }
    )
  } else {
    console.log(
      "\n[qstash:setup:all] Retention sweep skipped (pass --with-retention after DPO sign-off, AUD-028)"
    )
  }

  console.log("\n[qstash:setup:all] Done.")
  console.log(
    "  Verify with: pnpm qstash:list   (or via the Upstash Console → Schedules)"
  )
}

main().catch((err) => {
  console.error("[qstash:setup:all] Failed:", err)
  process.exit(1)
})
