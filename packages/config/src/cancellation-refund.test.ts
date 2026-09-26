import { describe, expect, it } from "vitest"
import {
  cancellationDeadlines,
  cancellationRefundCents,
  describeCancellationDeadlines,
  resolveCancellationRefund,
} from "./cancellation-policy"

const H = 3_600_000
const startsAt = new Date("2026-11-20T10:00:00.000Z")
const before = (hours: number) => new Date(startsAt.getTime() - hours * H)
const longAgo = before(30 * 24)

function percent(
  policy: "flexible" | "moderate" | "strict",
  hoursBefore: number,
  bookedAt: Date = longAgo
) {
  return resolveCancellationRefund({
    policy,
    bookedAt,
    startsAt,
    now: before(hoursBefore),
  }).refundPercent
}

describe("resolveCancellationRefund tiers", () => {
  it("flexible: full until 24h, then nothing", () => {
    expect(percent("flexible", 100)).toBe(100)
    expect(percent("flexible", 24)).toBe(100)
    expect(percent("flexible", 23.99)).toBe(0)
    expect(percent("flexible", 1)).toBe(0)
  })

  it("moderate: full until 48h, half until 24h, then nothing", () => {
    expect(percent("moderate", 48)).toBe(100)
    expect(percent("moderate", 47.99)).toBe(50)
    expect(percent("moderate", 24)).toBe(50)
    expect(percent("moderate", 23.99)).toBe(0)
  })

  it("strict: full until 7 days, half until 48h, then nothing", () => {
    expect(percent("strict", 7 * 24)).toBe(100)
    expect(percent("strict", 7 * 24 - 0.01)).toBe(50)
    expect(percent("strict", 48)).toBe(50)
    expect(percent("strict", 47.99)).toBe(0)
  })

  it("reports when the refund next drops and the full-refund deadline", () => {
    const quote = resolveCancellationRefund({
      policy: "moderate",
      bookedAt: longAgo,
      startsAt,
      now: before(30),
    })
    expect(quote.reason).toBe("policy_tier")
    expect(quote.nextChangeAt).toEqual(before(24))
    expect(quote.fullRefundUntil).toBeNull()

    const early = resolveCancellationRefund({
      policy: "strict",
      bookedAt: longAgo,
      startsAt,
      now: before(10 * 24),
    })
    expect(early.fullRefundUntil).toEqual(before(7 * 24))
    expect(early.nextChangeAt).toEqual(before(7 * 24))

    const last = resolveCancellationRefund({
      policy: "flexible",
      bookedAt: longAgo,
      startsAt,
      now: before(2),
    })
    expect(last.nextChangeAt).toBeNull()
  })
})

describe("resolveCancellationRefund grace period", () => {
  it("refunds in full within 24h of booking when the session is 48h+ away", () => {
    const bookedAt = before(5 * 24)
    const quote = resolveCancellationRefund({
      policy: "strict",
      bookedAt,
      startsAt,
      now: new Date(bookedAt.getTime() + 23 * H),
    })
    expect(quote.refundPercent).toBe(100)
    expect(quote.reason).toBe("grace_period")
    expect(quote.nextChangeAt).toEqual(new Date(bookedAt.getTime() + 24 * H))
  })

  it("ends after 24h from booking", () => {
    const bookedAt = before(5 * 24)
    expect(
      resolveCancellationRefund({
        policy: "strict",
        bookedAt,
        startsAt,
        now: new Date(bookedAt.getTime() + 25 * H),
      }).refundPercent
    ).toBe(50)
  })

  it("ends 48h before the session even inside the first 24h", () => {
    const bookedAt = before(60)
    const quote = resolveCancellationRefund({
      policy: "strict",
      bookedAt,
      startsAt,
      now: before(47),
    })
    expect(quote.refundPercent).toBe(0)
    expect(quote.reason).toBe("policy_tier")
  })

  it("applies to a booking made exactly 48h before the session", () => {
    const bookedAt = before(48)
    expect(percent("strict", 48, bookedAt)).toBe(100)
  })

  it("does not apply to a booking made under 48h before the session", () => {
    const bookedAt = before(30)
    expect(percent("moderate", 29, bookedAt)).toBe(50)
    expect(percent("flexible", 20, bookedAt)).toBe(0)
  })
})

describe("resolveCancellationRefund across DST", () => {
  it("counts real hours when the clocks change (Lisbon, 2026-10-25)", () => {
    const sessionStart = new Date("2026-10-26T09:00:00.000Z")
    const now = new Date("2026-10-25T09:30:00.000Z")
    expect(
      resolveCancellationRefund({
        policy: "flexible",
        bookedAt: new Date("2026-10-01T00:00:00.000Z"),
        startsAt: sessionStart,
        now,
      }).refundPercent
    ).toBe(0)
  })
})

describe("cancellationRefundCents", () => {
  it("scales and rounds the refundable amount", () => {
    expect(cancellationRefundCents(6000, 100)).toBe(6000)
    expect(cancellationRefundCents(6000, 50)).toBe(3000)
    expect(cancellationRefundCents(6001, 50)).toBe(3001)
    expect(cancellationRefundCents(6000, 0)).toBe(0)
    expect(cancellationRefundCents(0, 100)).toBe(0)
  })
})

describe("cancellationDeadlines", () => {
  const iso = (d: Date) => d.toISOString()

  it("lists every refund step for a strict booking made weeks ahead", () => {
    const deadlines = cancellationDeadlines({
      policy: "strict",
      bookedAt: longAgo,
      startsAt,
    })
    expect(deadlines.map((d) => [d.refundPercent, iso(d.until)])).toEqual([
      [100, iso(before(7 * 24))],
      [50, iso(before(48))],
    ])
  })

  it("extends the full refund to the grace period end", () => {
    const deadlines = cancellationDeadlines({
      policy: "strict",
      bookedAt: before(100),
      startsAt,
    })
    expect(deadlines.map((d) => [d.refundPercent, iso(d.until)])).toEqual([
      [100, iso(before(76))],
      [50, iso(before(48))],
    ])
  })

  it("returns no steps when the booking is already past every refund", () => {
    expect(
      cancellationDeadlines({
        policy: "flexible",
        bookedAt: before(2),
        startsAt,
      })
    ).toEqual([])
  })

  it("describes deadlines with the given date formatter", () => {
    const lines = describeCancellationDeadlines(
      [{ refundPercent: 100, until: before(24) }],
      "en",
      () => "19 Nov, 10:00"
    )
    expect(lines).toEqual([
      "Full refund if you cancel before 19 Nov, 10:00.",
      "No refund if you cancel after 19 Nov, 10:00.",
    ])
  })
})
