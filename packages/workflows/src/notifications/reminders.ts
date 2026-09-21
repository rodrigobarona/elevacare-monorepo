import { Client } from "@upstash/qstash"
import { sendBookingNotification } from "@eleva/notifications"

export const BOOKING_REMINDER_KINDS = [
  "booking.reminder_24h",
  "booking.reminder_1h",
] as const

export type BookingReminderKind = (typeof BOOKING_REMINDER_KINDS)[number]

export const BOOKING_REMINDER_OFFSETS_MS = {
  "booking.reminder_24h": 24 * 60 * 60 * 1000,
  "booking.reminder_1h": 60 * 60 * 1000,
} as const

export type BookingReminderRequest = {
  bookingId: string
  orgId: string
  kind: BookingReminderKind
  startsAt: string
}

export type PlannedReminder = {
  kind: BookingReminderKind
  notBeforeUnix: number
  deduplicationId: string
  body: BookingReminderRequest
}

export type ReminderPublisher = (
  job: PlannedReminder
) => Promise<"published" | "skipped">

export function reminderFireAt(
  startsAt: Date,
  kind: BookingReminderKind
): Date {
  return new Date(startsAt.getTime() - BOOKING_REMINDER_OFFSETS_MS[kind])
}

export function reminderDeduplicationId(
  bookingId: string,
  kind: BookingReminderKind,
  startsAt: string
): string {
  return `${bookingId}:${kind}:${startsAt}`
}

export function planBookingReminders(input: {
  bookingId: string
  orgId: string
  startsAt: Date
  now?: Date
}): PlannedReminder[] {
  if (Number.isNaN(input.startsAt.getTime())) {
    throw new Error("booking-reminder: startsAt is invalid")
  }
  const nowMs = (input.now ?? new Date()).getTime()
  const jobs: PlannedReminder[] = []
  for (const kind of BOOKING_REMINDER_KINDS) {
    const fireAt = reminderFireAt(input.startsAt, kind)
    if (fireAt.getTime() <= nowMs) continue
    jobs.push({
      kind,
      notBeforeUnix: Math.floor(fireAt.getTime() / 1000),
      deduplicationId: reminderDeduplicationId(
        input.bookingId,
        kind,
        input.startsAt.toISOString()
      ),
      body: {
        bookingId: input.bookingId,
        orgId: input.orgId,
        kind,
        startsAt: input.startsAt.toISOString(),
      },
    })
  }
  return jobs
}

export async function scheduleBookingReminders(
  input: {
    bookingId: string
    orgId: string
    startsAt: Date
    now?: Date
  },
  publish: ReminderPublisher = publishReminderJob
): Promise<{
  scheduled: BookingReminderKind[]
  skipped: BookingReminderKind[]
}> {
  const planned = planBookingReminders(input)
  const scheduled: BookingReminderKind[] = []
  const skipped: BookingReminderKind[] = BOOKING_REMINDER_KINDS.filter(
    (kind) => !planned.some((job) => job.kind === kind)
  )
  for (const job of planned) {
    const result = await publish(job)
    if (result === "published") {
      scheduled.push(job.kind)
      continue
    }
    skipped.push(job.kind)
  }
  return { scheduled, skipped }
}

export async function publishReminderJob(
  job: PlannedReminder
): Promise<"published" | "skipped"> {
  const token = process.env.QSTASH_TOKEN
  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  const apiBase = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "")

  if (!token || !secret || !apiBase || apiBase.includes("localhost")) {
    return "skipped"
  }

  const destination = `${apiBase}/workflows/booking-reminder`
  let parsed: URL
  try {
    parsed = new URL(destination)
  } catch {
    throw new Error("booking-reminder destination is not a valid URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("booking-reminder destination must use https")
  }

  const client = new Client({ token })
  await client.publishJSON({
    url: destination,
    body: job.body,
    notBefore: job.notBeforeUnix,
    deduplicationId: job.deduplicationId,
    headers: { Authorization: `Bearer ${secret}` },
  })
  return "published"
}

export async function deliverBookingReminder(
  input: BookingReminderRequest,
  deps: { send?: typeof sendBookingNotification } = {}
): Promise<{ ok: true; status: "processed" }> {
  const send = deps.send ?? sendBookingNotification
  await send({
    id: `reminder:${input.bookingId}:${input.kind}`,
    type: input.kind,
    orgId: input.orgId,
    payload: {
      bookingId: input.bookingId,
      startsAt: input.startsAt,
      occurredAt: new Date().toISOString(),
    },
  })
  return { ok: true, status: "processed" }
}
