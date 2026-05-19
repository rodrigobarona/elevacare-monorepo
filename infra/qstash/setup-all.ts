/**
 * Provision every QStash schedule the platform needs in one call.
 *
 * Use this when promoting from staging → production, after rotating
 * QStash tokens, or after migrating to a new API base URL.
 *
 * Idempotent: each helper deletes any existing schedule pointing at
 * the same destination before creating a new one, so this is safe to
 * re-run.
 *
 * Usage:
 *   API_BASE_URL=https://api.eleva.care pnpm qstash:setup:all
 *   API_BASE_URL=https://api.eleva.care pnpm qstash:setup:all -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"

const dryRun = isDryRun()

async function main() {
  console.log(
    dryRun
      ? "[qstash:setup:all] DRY RUN — no schedules will be created"
      : "[qstash:setup:all] Provisioning all schedules"
  )

  await registerSchedule(
    {
      name: "WorkOS Events poller",
      path: "/workos/sync",
      cron: "*/5 * * * *",
      retries: 3,
      requireBearer: false,
      description:
        "Poll WorkOS Events API for user/org/role mutations and mirror locally",
    },
    { dryRun }
  )

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
      name: "Stripe stuck-event detector",
      path: "/workflows/stripe-stuck-events",
      cron: "*/10 * * * *",
      retries: 3,
      requireBearer: true,
      description:
        "Detect stuck stripe_webhook_events rows and raise Sentry alerts",
    },
    { dryRun }
  )

  console.log("\n[qstash:setup:all] Done.")
  console.log(
    "  Verify with: pnpm qstash:list   (or via the Upstash Console → Schedules)"
  )
}

main().catch((err) => {
  console.error("[qstash:setup:all] Failed:", err)
  process.exit(1)
})
