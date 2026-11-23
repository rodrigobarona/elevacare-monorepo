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
 * - QStash does not skip: it retries a failed run three times over about
 *   33 minutes (12 s, 2.5 min, 30 min). Those jobs wait one hour, which is
 *   less than one missed run on purpose; the monthly one waits six.
 */

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Trigger = "vercel-cron" | "tick" | "qstash"

interface ScheduledJob {
  /** The route that runs it. */
  path: string
  /** What starts it. A `tick` job runs inside the tick of its `cadence`. */
  trigger: Trigger
  /** Cron expression of the schedule that starts it, in UTC. */
  schedule: string
  /** How often a run is expected. */
  periodSeconds: number
  /** How late a run may report before it counts as missed. */
  graceSeconds: number
  /** `tick` jobs only: the tick it runs in. */
  cadence?: TickCadence
  /**
   * Set while the schedule is not registered: what it waits for. Such a
   * job does not run, so a monitor for it must not be created yet.
   */
  notRegisteredUntil?: string
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

export type TickCadence = keyof typeof TICK_SCHEDULES

const tick = <Cadence extends TickCadence>(cadence: Cadence) => ({
  path: `/workflows/tick/${cadence}` as const,
  trigger: "vercel-cron" as const,
  ...TICK_SCHEDULES[cadence],
})

/** A job that runs inside a tick: expected as often as the tick runs. */
const inTick = <Name extends string, Cadence extends TickCadence>(
  name: Name,
  cadence: Cadence
) => ({
  path: `/workflows/${name}` as const,
  trigger: "tick" as const,
  cadence,
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
  "tick-minutely": tick("minutely"),
  "tick-10min": tick("10min"),
  "tick-hourly": tick("hourly"),

  // Inside a tick (`apps/api/src/lib/workflow-ticks.ts`, which must list
  // the same jobs under the same cadence, or it does not compile).
  "slot-reservation-expiry": inTick("slot-reservation-expiry", "minutely"),
  "booking-request-expiry": inTick("booking-request-expiry", "minutely"),
  "domain-events-publisher": inTick("domain-events-publisher", "minutely"),
  "video-eject-retry": inTick("video-eject-retry", "minutely"),
  "stripe-stuck-events": inTick("stripe-stuck-events", "10min"),
  "video-room-sweep": inTick("video-room-sweep", "10min"),
  "video-attendance-sweep": inTick("video-attendance-sweep", "10min"),
  "seat-sync-sweep": inTick("seat-sync-sweep", "10min"),
  "audit-outbox-drainer": inTick("audit-outbox-drainer", "hourly"),
  "account-deletion-sweep": inTick("account-deletion-sweep", "hourly"),
  "crm-follow-up-due": inTick("crm-follow-up-due", "hourly"),
  "invoicing-retry": inTick("invoicing-retry", "hourly"),

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
    // The longest month, so a 31-day month is not a missed run. After a
    // shorter month a missed run shows up to three days late.
    periodSeconds: 31 * DAY,
    graceSeconds: 6 * HOUR,
  },
  "retention-sweep": {
    path: "/workflows/retention-sweep",
    trigger: "qstash",
    schedule: "0 2 * * *",
    periodSeconds: DAY,
    graceSeconds: HOUR,
    // `pnpm qstash:setup:all -- --with-retention` registers it.
    notRegisteredUntil: "the DPO signs the retention periods (AUD-028)",
  },
} as const satisfies Record<string, ScheduledJob>

/**
 * Jobs that run when something asks, not on a schedule. Nothing can say
 * one is late, so no monitor watches them: a run that fails is sent to
 * Sentry by its route and answers 500, which QStash retries.
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

/** The jobs that run inside the tick of one cadence. */
export type JobsInTick<Cadence extends TickCadence> = {
  [Name in ScheduledJobName]: (typeof BACKGROUND_JOBS)[Name] extends {
    cadence: Cadence
  }
    ? Name
    : never
}[ScheduledJobName]

export function isScheduledJob(name: string): name is ScheduledJobName {
  return Object.hasOwn(BACKGROUND_JOBS, name)
}

export function isOnDemandJob(name: string): name is OnDemandJobName {
  return Object.hasOwn(ON_DEMAND_JOBS, name)
}
