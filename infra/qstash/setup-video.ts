/**
 * QStash schedule for Daily room backfill.
 *
 * - `POST /workflows/video-room-sweep` every 15 minutes
 * - `POST /workflows/video-eject-retry` every minute
 * - `POST /workflows/video-attendance-sweep` every 15 minutes
 *
 * Auth: bearer `WORKFLOWS_DRAIN_SECRET`.
 *
 * Usage:
 *   pnpm qstash:setup:video
 *   pnpm qstash:setup:video -- --dry-run
 */
import { isDryRun, registerSchedule } from "./register-schedule"
import {
  VIDEO_ATTENDANCE_SWEEP_SCHEDULE,
  VIDEO_EJECT_RETRY_SCHEDULE,
  VIDEO_ROOM_SWEEP_SCHEDULE,
} from "./video-schedules"

export {
  VIDEO_ATTENDANCE_SWEEP_SCHEDULE,
  VIDEO_EJECT_RETRY_SCHEDULE,
  VIDEO_ROOM_SWEEP_SCHEDULE,
}

async function main() {
  const dryRun = isDryRun()
  await registerSchedule(VIDEO_ROOM_SWEEP_SCHEDULE, { dryRun })
  await registerSchedule(VIDEO_EJECT_RETRY_SCHEDULE, { dryRun })
  await registerSchedule(VIDEO_ATTENDANCE_SWEEP_SCHEDULE, { dryRun })
}

main().catch((err) => {
  console.error("[qstash:video] Failed:", err)
  process.exit(1)
})
