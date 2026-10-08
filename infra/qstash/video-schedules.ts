export const VIDEO_ROOM_SWEEP_SCHEDULE = {
  name: "Video room sweep",
  path: "/workflows/video-room-sweep",
  cron: "*/15 * * * *",
  retries: 3,
  requireBearer: true,
  description:
    "Create Daily rooms for confirmed online bookings starting within 2 hours that still have no room",
} as const

export const VIDEO_EJECT_RETRY_SCHEDULE = {
  name: "Video eject retry",
  path: "/workflows/video-eject-retry",
  cron: "* * * * *",
  retries: 3,
  requireBearer: true,
  description:
    "Complete Daily eject+ban for revoked session participants and repair stale room capacity",
} as const

export const VIDEO_ATTENDANCE_SWEEP_SCHEDULE = {
  name: "Video attendance fallback",
  path: "/workflows/video-attendance-sweep",
  cron: "*/15 * * * *",
  retries: 3,
  requireBearer: true,
  description:
    "Finalize attendance from participant history after the Eleva join window (endsAt+30m) when Daily sent no meeting.ended",
} as const
