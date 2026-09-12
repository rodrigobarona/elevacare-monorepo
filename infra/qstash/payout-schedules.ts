import type { ScheduleSpec } from "./register-schedule"

export const PAYOUT_SCHEDULES = [
  {
    name: "Process expert transfers",
    path: "/workflows/process-expert-transfers",
    cron: "0 */2 * * *",
    retries: 3,
    requireBearer: true,
    description:
      "Create Stripe Transfers for scheduled eligible payouts (every 2h)",
  },
  {
    name: "Process pending payouts",
    path: "/workflows/process-pending-payouts",
    cron: "0 5 * * *",
    retries: 3,
    requireBearer: true,
    description:
      "Promote pending payouts to scheduled at 05:00 UTC (~06:00 Europe/Lisbon in WEST)",
  },
  {
    name: "Check upcoming payouts",
    path: "/workflows/check-upcoming-payouts",
    cron: "0 7 * * *",
    retries: 3,
    requireBearer: true,
    description:
      "Alert on payouts becoming eligible within 48h at 07:00 UTC (~08:00 Europe/Lisbon in WEST)",
  },
] as const satisfies readonly ScheduleSpec[]
