/**
 * QStash schedule for Daily room backfill.
 *
 * - `POST /workflows/video-room-sweep` every 15 minutes
 *
 * Auth: bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:video
 *   pnpm qstash:setup:video -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"
import { VIDEO_ROOM_SWEEP_SCHEDULE } from "./video-schedules"

export { VIDEO_ROOM_SWEEP_SCHEDULE }

async function main() {
  const dryRun = isDryRun()
  await registerSchedule(VIDEO_ROOM_SWEEP_SCHEDULE, { dryRun })
}

main().catch((err) => {
  console.error("[qstash:video] Failed:", err)
  process.exit(1)
})
