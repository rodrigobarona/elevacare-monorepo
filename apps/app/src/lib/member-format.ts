export const MEMBER_CANCEL_POLICY_HOURS = 24

const MUTABLE_STATUSES = new Set(["confirmed", "rescheduled"])

export function eventTitle(
  title: { en: string; pt?: string; es?: string },
  locale: string
): string {
  if (locale === "pt" && title.pt) return title.pt
  if (locale === "es" && title.es) return title.es
  return title.en
}

export function formatMoney(
  amountCents: number,
  locale: string,
  currency = "EUR"
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amountCents / 100
  )
}

export function formatDateTime(
  iso: string,
  locale: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso))
}

export function canChangeBooking(
  startsAt: string,
  status: string,
  now = new Date()
): boolean {
  if (!MUTABLE_STATUSES.has(status)) return false
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return false
  return (
    start.getTime() - now.getTime() >=
    MEMBER_CANCEL_POLICY_HOURS * 60 * 60 * 1000
  )
}

export function toDatetimeLocalValue(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

type WallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function wallClockInZone(ms: number, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  }
}

function sameWallClock(left: WallClock, right: WallClock): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  )
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const zoned = wallClockInZone(instant, timeZone)
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute
  )
  return asUtc - instant
}

/**
 * Convert a datetime-local wall clock in `timeZone` to UTC ISO.
 * Nonexistent DST-gap times throw. Ambiguous DST-overlap times use the
 * earlier occurrence.
 */
export function fromDatetimeLocalValue(
  localValue: string,
  timeZone: string
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) {
    throw new Error("invalid datetime")
  }
  const wanted: WallClock = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
  const utcGuess = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute
  )
  const first = utcGuess - zoneOffsetMs(utcGuess, timeZone)
  const instant = utcGuess - zoneOffsetMs(first, timeZone)
  if (!sameWallClock(wallClockInZone(instant, timeZone), wanted)) {
    throw new Error("invalid datetime")
  }
  const hourMs = 60 * 60 * 1000
  const candidates = [instant]
  for (const probe of [instant - hourMs, instant + hourMs]) {
    if (sameWallClock(wallClockInZone(probe, timeZone), wanted)) {
      candidates.push(probe)
    }
  }
  return new Date(Math.min(...candidates)).toISOString()
}
