import { describe, expect, it, vi } from "vitest"
import {
  BOOKING_REMINDER_KINDS,
  deliverBookingReminder,
  planBookingReminders,
  reminderDeduplicationId,
  reminderFireAt,
  scheduleBookingReminders,
} from "./reminders"

const BOOKING_ID = "00000000-0000-4000-8000-000000000002"
const ORG_ID = "00000000-0000-4000-8000-000000000001"
const STARTS_AT = new Date("2026-09-22T15:00:00.000Z")

describe("booking reminder scheduling math", () => {
  it("fires 24h and 1h before start", () => {
    expect(
      reminderFireAt(STARTS_AT, "booking.reminder_24h").toISOString()
    ).toBe("2026-09-21T15:00:00.000Z")
    expect(reminderFireAt(STARTS_AT, "booking.reminder_1h").toISOString()).toBe(
      "2026-09-22T14:00:00.000Z"
    )
  })

  it("uses bookingId:kind as the QStash deduplication id", () => {
    expect(
      reminderDeduplicationId(
        BOOKING_ID,
        "booking.reminder_24h",
        STARTS_AT.toISOString()
      )
    ).toBe(`${BOOKING_ID}:booking.reminder_24h:${STARTS_AT.toISOString()}`)
    expect(
      reminderDeduplicationId(
        BOOKING_ID,
        "booking.reminder_1h",
        STARTS_AT.toISOString()
      )
    ).toBe(`${BOOKING_ID}:booking.reminder_1h:${STARTS_AT.toISOString()}`)
  })

  it("schedules both jobs for a booking 25h ahead", () => {
    const now = new Date("2026-09-21T14:00:00.000Z")
    const jobs = planBookingReminders({
      bookingId: BOOKING_ID,
      orgId: ORG_ID,
      startsAt: STARTS_AT,
      now,
    })
    expect(jobs.map((job) => job.kind)).toEqual([...BOOKING_REMINDER_KINDS])
    expect(jobs[0]?.notBeforeUnix).toBe(
      Date.parse("2026-09-21T15:00:00.000Z") / 1000
    )
    expect(jobs[1]?.notBeforeUnix).toBe(
      Date.parse("2026-09-22T14:00:00.000Z") / 1000
    )
    expect(jobs[0]?.body.startsAt).toBe(STARTS_AT.toISOString())
  })

  it("skips the 24h job when start is only 2h away", () => {
    const now = new Date("2026-09-22T13:00:00.000Z")
    const jobs = planBookingReminders({
      bookingId: BOOKING_ID,
      orgId: ORG_ID,
      startsAt: STARTS_AT,
      now,
    })
    expect(jobs.map((job) => job.kind)).toEqual(["booking.reminder_1h"])
  })

  it("skips both jobs when start is already inside the 1h window", () => {
    const now = new Date("2026-09-22T14:30:00.000Z")
    const jobs = planBookingReminders({
      bookingId: BOOKING_ID,
      orgId: ORG_ID,
      startsAt: STARTS_AT,
      now,
    })
    expect(jobs).toEqual([])
  })
})

describe("scheduleBookingReminders", () => {
  it("publishes planned jobs and reports skipped offsets", async () => {
    const publish = vi.fn(async () => "published" as const)
    const result = await scheduleBookingReminders(
      {
        bookingId: BOOKING_ID,
        orgId: ORG_ID,
        startsAt: STARTS_AT,
        now: new Date("2026-09-21T14:00:00.000Z"),
      },
      publish
    )
    expect(publish).toHaveBeenCalledTimes(2)
    expect(result.scheduled).toEqual([...BOOKING_REMINDER_KINDS])
    expect(result.skipped).toEqual([])
  })
})

describe("deliverBookingReminder", () => {
  it("sends through sendBookingNotification", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    await deliverBookingReminder(
      {
        bookingId: BOOKING_ID,
        orgId: ORG_ID,
        kind: "booking.reminder_24h",
        startsAt: STARTS_AT.toISOString(),
      },
      { send }
    )
    expect(send).toHaveBeenCalledWith({
      id: `reminder:${BOOKING_ID}:booking.reminder_24h`,
      type: "booking.reminder_24h",
      orgId: ORG_ID,
      payload: expect.objectContaining({
        bookingId: BOOKING_ID,
        startsAt: STARTS_AT.toISOString(),
      }),
    })
  })
})
