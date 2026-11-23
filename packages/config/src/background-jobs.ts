/**
 * Every background job the API runs, and how often each is expected.
 *
 * One list for three readers: the routes (which name they report under),
 * the reporter in `@eleva/observability` (which jobs a monitor can watch),
 * and the script that will create the monitors (slice 13.19), which reads
 * `periodSeconds` and `graceSeconds` instead of deriving them again.
 *
 * A job's name is its route folder: `/workflows/{name}` or `/cron/{name}`.
 * The three ticks are `tick-{cadence}` for `/workflows/tick/{cadence}`.
 *
 * Grace is how late a run may report before it counts as missed:
 * - Vercel Cron delivers at best effort and never retries, so one skipped
 *   run is expected now and then. Jobs that run every minute or every ten
 *   minutes wait for two missed runs; hourly and daily jobs for one.
 * - QStash retries a failed run three times over about 33 minutes (12 s,
 *   2.5 min, 30 min). Those jobs get one hour, the monthly one six.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Trigger = "vercel-cron" | "tick" | "qstash"

interface ScheduledJob {
  /** The route that runs it. */
  path: string
  /** What starts it. A `tick` job runs inside the tick of its cadence. */
  trigger: Trigger
  /** Cron expression of the schedule that starts it, in UTC. */
  schedule: string
  /** How often a run is expected. */
  periodSeconds: number
  /** How late a run may report before it counts as missed. */
  graceSeconds: number
}

/** The three ticks: their Vercel Cron schedule, period and grace. */
const TICK_SCHEDULES = {
  minutely: {
    schedule: "* * * * *",
    periodSeconds: MINUTE,
    graceSeconds: 2 * MINUTE,
  },
  "10min": {
    schedule: "*/10 * * * *",
    periodSeconds: 10 * MINUTE,
    graceSeconds: 20 * MINUTE,
  },
  hourly: {
    schedule: "5 * * * *",
    periodSeconds: HOUR,
    graceSeconds: HOUR,
  },
} as const

const tickJob = (
  name: string,
  cadence: keyof typeof TICK_SCHEDULES
): ScheduledJob => ({
  path: `/workflows/${name}`,
  trigger: "tick",
  ...TICK_SCHEDULES[cadence],
})

export const BACKGROUND_JOBS = {
  // Vercel Cron (`apps/api/vercel.json`).
  "keep-alive": {
    path: "/cron/keep-alive",
    trigger: "vercel-cron",
    schedule: "0 6 * * *",
    periodSeconds: DAY,
    graceSeconds: DAY,
  },
  "booking-probes": {
    path: "/cron/booking-probes",
    trigger: "vercel-cron",
    schedule: "15 6 * * *",
    periodSeconds: DAY,
    graceSeconds: DAY,
  },
  "tick-minutely": {
    path: "/workflows/tick/minutely",
    trigger: "vercel-cron",
    ...TICK_SCHEDULES.minutely,
  },
  "tick-10min": {
    path: "/workflows/tick/10min",
    trigger: "vercel-cron",
    ...TICK_SCHEDULES["10min"],
  },
  "tick-hourly": {
    path: "/workflows/tick/hourly",
    trigger: "vercel-cron",
    ...TICK_SCHEDULES.hourly,
  },

  // Inside a tick (`apps/api/src/lib/workflow-ticks.ts`).
  "slot-reservation-expiry": tickJob("slot-reservation-expiry", "minutely"),
  "booking-request-expiry": tickJob("booking-request-expiry", "minutely"),
  "domain-events-publisher": tickJob("domain-events-publisher", "minutely"),
  "video-eject-retry": tickJob("video-eject-retry", "minutely"),
  "stripe-stuck-events": tickJob("stripe-stuck-events", "10min"),
  "video-room-sweep": tickJob("video-room-sweep", "10min"),
  "video-attendance-sweep": tickJob("video-attendance-sweep", "10min"),
  "seat-sync-sweep": tickJob("seat-sync-sweep", "10min"),
  "audit-outbox-drainer": tickJob("audit-outbox-drainer", "hourly"),
  "account-deletion-sweep": tickJob("account-deletion-sweep", "hourly"),
  "crm-follow-up-due": tickJob("crm-follow-up-due", "hourly"),
  "invoicing-retry": tickJob("invoicing-retry", "hourly"),

  // QStash schedules (`infra/qstash`).
  "process-expert-transfers": {
    path: "/workflows/process-expert-transfers",
    trigger: "qstash",
    schedule: "0 */2 * * *",
    periodSeconds: 2 * HOUR,
    graceSeconds: HOUR,
  },
  "process-pending-payouts": {
    path: "/workflows/process-pending-payouts",
    trigger: "qstash",
    schedule: "0 5 * * *",
    periodSeconds: DAY,
    graceSeconds: HOUR,
  },
  "check-upcoming-payouts": {
    path: "/workflows/check-upcoming-payouts",
    trigger: "qstash",
    schedule: "0 7 * * *",
    periodSeconds: DAY,
    graceSeconds: HOUR,
  },
  "stripe-toconline-reconciliation": {
    path: "/workflows/stripe-toconline-reconciliation",
    trigger: "qstash",
    schedule: "0 4 1 * *",
    // The longest month, so a 31-day month is not a missed run.
    periodSeconds: 31 * DAY,
    graceSeconds: 6 * HOUR,
  },
  // Registered only with `--with-retention`, after the DPO signs (AUD-028).
  // Until then it does not run, and a monitor for it stays pending.
  "retention-sweep": {
    path: "/workflows/retention-sweep",
    trigger: "qstash",
    schedule: "0 2 * * *",
    periodSeconds: DAY,
    graceSeconds: HOUR,
  },
} as const satisfies Record<string, ScheduledJob>

/**
 * Jobs that run when something asks, not on a schedule. Nothing can say
 * one is late, so no monitor watches them: a failed run goes to Sentry and
 * answers 500, which QStash retries.
 */
export const ON_DEMAND_JOBS = {
  "booking-reminder":
    "One delayed QStash message per booking, sent when it is confirmed.",
  "dsar-export": "Queued when a member asks for a copy of their data.",
  "kek-rotation": "Run by the operator when a key is rotated.",
} as const satisfies Record<string, string>

export type ScheduledJobName = keyof typeof BACKGROUND_JOBS
export type OnDemandJobName = keyof typeof ON_DEMAND_JOBS
export type BackgroundJobName = ScheduledJobName | OnDemandJobName

export function isScheduledJob(name: string): name is ScheduledJobName {
  return Object.hasOwn(BACKGROUND_JOBS, name)
}
