import { describe, expect, it, vi } from "vitest"
import {
  BOOKING_REMINDER_KINDS,
  deliverBookingReminder,
  isLocalReminderApiBase,
  planBookingReminders,
  publishReminderJob,
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

function restoreEnv(
  key: "QSTASH_TOKEN" | "WORKFLOWS_DRAIN_SECRET" | "API_URL" | "VERCEL_ENV",
  previous: string | undefined
): void {
  if (previous === undefined) delete process.env[key]
  else process.env[key] = previous
}

describe("isLocalReminderApiBase", () => {
  it("matches only loopback hostnames", () => {
    expect(isLocalReminderApiBase("http://localhost:3002")).toBe(true)
    expect(isLocalReminderApiBase("http://127.0.0.1:3002")).toBe(true)
    expect(isLocalReminderApiBase("http://[::1]:3002")).toBe(true)
    expect(isLocalReminderApiBase("https://not-localhost.example")).toBe(false)
    expect(isLocalReminderApiBase("https://api.eleva.care")).toBe(false)
    expect(isLocalReminderApiBase("")).toBe(false)
  })
})

describe("publishReminderJob", () => {
  it("skips only when the API base URL is explicit localhost", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
      vercelEnv: process.env.VERCEL_ENV,
    }
    process.env.API_URL = "http://localhost:3002"
    delete process.env.VERCEL_ENV
    delete process.env.QSTASH_TOKEN
    delete process.env.WORKFLOWS_DRAIN_SECRET
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).resolves.toBe("skipped")
    } finally {
      restoreEnv("QSTASH_TOKEN", previous.token)
      restoreEnv("WORKFLOWS_DRAIN_SECRET", previous.secret)
      restoreEnv("API_URL", previous.apiUrl)
      restoreEnv("VERCEL_ENV", previous.vercelEnv)
    }
  })

  it("does not skip a hostname that only contains localhost", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
    }
    process.env.API_URL = "https://not-localhost.example"
    delete process.env.QSTASH_TOKEN
    delete process.env.WORKFLOWS_DRAIN_SECRET
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).rejects.toThrow(/QSTASH_TOKEN/)
    } finally {
      restoreEnv("QSTASH_TOKEN", previous.token)
      restoreEnv("WORKFLOWS_DRAIN_SECRET", previous.secret)
      restoreEnv("API_URL", previous.apiUrl)
    }
  })

  it("skips a missing API_URL only outside Vercel production and preview", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
      vercelEnv: process.env.VERCEL_ENV,
    }
    delete process.env.API_URL
    delete process.env.VERCEL_ENV
    process.env.QSTASH_TOKEN = "qstash-token"
    process.env.WORKFLOWS_DRAIN_SECRET = "workflow-secret"
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).resolves.toBe("skipped")
    } finally {
      restoreEnv("QSTASH_TOKEN", previous.token)
      restoreEnv("WORKFLOWS_DRAIN_SECRET", previous.secret)
      restoreEnv("API_URL", previous.apiUrl)
      restoreEnv("VERCEL_ENV", previous.vercelEnv)
    }
  })

  it("throws when a deployed environment is missing API_URL", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
      vercelEnv: process.env.VERCEL_ENV,
    }
    delete process.env.API_URL
    process.env.VERCEL_ENV = "production"
    process.env.QSTASH_TOKEN = "qstash-token"
    process.env.WORKFLOWS_DRAIN_SECRET = "workflow-secret"
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).rejects.toThrow(/API_URL/)
    } finally {
      restoreEnv("QSTASH_TOKEN", previous.token)
      restoreEnv("WORKFLOWS_DRAIN_SECRET", previous.secret)
      restoreEnv("API_URL", previous.apiUrl)
      restoreEnv("VERCEL_ENV", previous.vercelEnv)
    }
  })

  it("throws when a deployed environment points at loopback", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
      vercelEnv: process.env.VERCEL_ENV,
    }
    process.env.API_URL = "http://localhost:3002"
    process.env.VERCEL_ENV = "production"
    process.env.QSTASH_TOKEN = "qstash-token"
    process.env.WORKFLOWS_DRAIN_SECRET = "workflow-secret"
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).rejects.toThrow(/loopback/)
    } finally {
      restoreEnv("QSTASH_TOKEN", previous.token)
      restoreEnv("WORKFLOWS_DRAIN_SECRET", previous.secret)
      restoreEnv("API_URL", previous.apiUrl)
      restoreEnv("VERCEL_ENV", previous.vercelEnv)
    }
  })

  it("throws in a deployed environment without QStash credentials", async () => {
    const previous = {
      token: process.env.QSTASH_TOKEN,
      secret: process.env.WORKFLOWS_DRAIN_SECRET,
      apiUrl: process.env.API_URL,
    }
    process.env.API_URL = "https://api.eleva.care"
    delete process.env.QSTASH_TOKEN
    delete process.env.WORKFLOWS_DRAIN_SECRET
    try {
      await expect(
        publishReminderJob({
          kind: "booking.reminder_24h",
          notBeforeUnix: 1_800_000_000,
          deduplicationId: "dedupe",
          body: {
            bookingId: BOOKING_ID,
            orgId: ORG_ID,
            kind: "booking.reminder_24h",
            startsAt: STARTS_AT.toISOString(),
          },
        })
      ).rejects.toThrow(/QSTASH_TOKEN/)
    } finally {
      if (previous.token === undefined) delete process.env.QSTASH_TOKEN
      else process.env.QSTASH_TOKEN = previous.token
      if (previous.secret === undefined)
        delete process.env.WORKFLOWS_DRAIN_SECRET
      else process.env.WORKFLOWS_DRAIN_SECRET = previous.secret
      if (previous.apiUrl === undefined) delete process.env.API_URL
      else process.env.API_URL = previous.apiUrl
    }
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
  const activeBooking = {
    id: BOOKING_ID,
    orgId: ORG_ID,
    status: "confirmed",
    startsAt: STARTS_AT,
    endsAt: new Date("2026-09-22T15:50:00.000Z"),
    timezone: "Europe/Lisbon",
    sessionMode: "online",
    bookedLocale: "en",
    memberUserId: "00000000-0000-4000-8000-000000000003",
    memberEmail: "ada@example.com",
    memberName: "Ada",
    guestEmail: null,
    guestName: null,
    expertUserId: "00000000-0000-4000-8000-000000000004",
    expertEmail: "ana@example.com",
    expertName: "Ana",
    eventTypeName: { en: "Visit" },
    scheduleRevision: 0,
    cancellationPolicy: "flexible" as const,
    currency: "EUR",
  }

  it("sends through sendBookingNotification when still confirmed", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const result = await deliverBookingReminder(
      {
        bookingId: BOOKING_ID,
        orgId: ORG_ID,
        kind: "booking.reminder_24h",
        startsAt: STARTS_AT.toISOString(),
      },
      { send, loadBooking: async () => activeBooking }
    )
    expect(result).toEqual({ ok: true, status: "sent" })
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

  it("skips cancelled bookings without sending", async () => {
    const send = vi.fn()
    const result = await deliverBookingReminder(
      {
        bookingId: BOOKING_ID,
        orgId: ORG_ID,
        kind: "booking.reminder_1h",
        startsAt: STARTS_AT.toISOString(),
      },
      {
        send,
        loadBooking: async () => ({ ...activeBooking, status: "cancelled" }),
      }
    )
    expect(result).toEqual({
      ok: true,
      status: "skipped",
      reason: "not_active",
    })
    expect(send).not.toHaveBeenCalled()
  })
})
