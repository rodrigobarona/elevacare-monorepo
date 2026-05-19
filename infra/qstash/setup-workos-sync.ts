/**
 * QStash schedule for the WorkOS Events API poller.
 *
 * Triggers `POST /workos/sync` every 5 minutes so user/org/role events
 * from WorkOS are mirrored into the local DB without relying on
 * webhooks (which the WorkOS plan doesn't include).
 *
 * Auth: the route accepts unsigned requests today (relies on its own
 * mechanism). When that changes, flip `requireBearer: true`.
 *
 * Usage:
 *   pnpm qstash:setup:workos-sync
 *   pnpm qstash:setup:workos-sync -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"

async function main() {
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
    { dryRun: isDryRun() }
  )
}

main().catch((err) => {
  console.error("[qstash:workos-sync] Failed:", err)
  process.exit(1)
})
