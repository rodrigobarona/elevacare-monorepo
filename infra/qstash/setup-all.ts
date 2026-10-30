/**
 * Provision every QStash schedule the platform needs in one call.
 *
 * Use this when promoting from staging → production, after rotating
 * QStash tokens, or after migrating to a new API base URL.
 *
 * The plan's schedule quota (10) is smaller than the number of recurring
 * jobs, so jobs that share a cadence share one tick schedule
 * (`POST /workflows/tick/{minutely|10min|hourly}`, see
 * `apps/api/src/lib/workflow-ticks.ts`). Daily, monthly and payout jobs keep
 * their own schedules. Per-job schedules superseded by a tick are removed.
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
  type ScheduleSpec,
} from "./register-schedule"
import { PAYOUT_SCHEDULES } from "./payout-schedules"

const dryRun = isDryRun()
const withRetention = process.argv.includes("--with-retention")

/** Jobs that now run inside a tick; their own schedules are removed. */
const TICKED_JOB_PATHS = [
  "/workflows/slot-reservation-expiry",
  "/workflows/booking-request-expiry",
  "/workflows/domain-events-publisher",
  "/workflows/video-eject-retry",
  "/workflows/stripe-stuck-events",
  "/workflows/video-room-sweep",
  "/workflows/video-attendance-sweep",
  "/workflows/account-deletion-sweep",
  "/workflows/crm-follow-up-due",
  "/workflows/invoicing-retry",
] as const

const TICK_SCHEDULES: ScheduleSpec[] = [
  {
    name: "Tick: every minute",
    path: "/workflows/tick/minutely",
    cron: "* * * * *",
    retries: 1,
    requireBearer: true,
    description:
      "Slot hold expiry, request-to-book expiry (100% refunds), domain events, video eject retry",
  },
  {
    name: "Tick: every 10 minutes",
    path: "/workflows/tick/10min",
    cron: "*/10 * * * *",
    retries: 3,
    requireBearer: true,
    description:
      "Stuck Stripe events, Daily room sweep (create missing, delete idle), attendance fallback",
  },
  {
    name: "Tick: hourly",
    path: "/workflows/tick/hourly",
    cron: "5 * * * *",
    retries: 3,
    requireBearer: true,
    description:
      "Account deletion sweep (D-12), CRM follow-up digest, invoicing retry (gate closed)",
  },
]

async function main() {
  console.log(
    dryRun
      ? "[qstash:setup:all] DRY RUN — no schedules will be created"
      : "[qstash:setup:all] Provisioning all schedules"
  )

  // Remove superseded per-job schedules first so the quota has room.
  const removed = await removeSchedulesFor(TICKED_JOB_PATHS, { dryRun })
  if (removed > 0) {
    console.log(`[qstash:setup:all] Removed ${removed} superseded schedules`)
  }

  for (const spec of TICK_SCHEDULES) {
    await registerSchedule(spec, { dryRun })
  }

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
    { dryRun }
  )

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
