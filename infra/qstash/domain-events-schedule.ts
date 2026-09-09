import type { ScheduleSpec } from "./register-schedule"

export const DOMAIN_EVENTS_PUBLISHER_SCHEDULE = {
  name: "Domain events publisher",
  path: "/workflows/domain-events-publisher",
  cron: "* * * * *",
  retries: 3,
  requireBearer: true,
  description: "Claim pending domain_event_deliveries every minute",
} as const satisfies ScheduleSpec
