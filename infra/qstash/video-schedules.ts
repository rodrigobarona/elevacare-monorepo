export const VIDEO_ROOM_SWEEP_SCHEDULE = {
  name: "Video room sweep",
  path: "/workflows/video-room-sweep",
  cron: "*/15 * * * *",
  retries: 3,
  requireBearer: true,
  description:
    "Create Daily rooms for confirmed online bookings starting within 2 hours that still have no room",
} as const
