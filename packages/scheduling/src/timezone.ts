/**
 * Timezone utilities using Intl.DateTimeFormat.formatToParts for
 * reliable timezone-aware date arithmetic without external deps.
 */

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dayOfWeek: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timezone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hour12: false,
    })
    partsCache.set(timezone, fmt)
  }
  return fmt
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function findPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? "0"
}

export function getDateParts(date: Date, timezone: string): DateParts {
  const parts = getFormatter(timezone).formatToParts(date)
  return {
    year: +findPart(parts, "year"),
    month: +findPart(parts, "month"),
    day: +findPart(parts, "day"),
    hour: +findPart(parts, "hour") % 24,
    minute: +findPart(parts, "minute"),
    second: +findPart(parts, "second"),
    dayOfWeek: WEEKDAY_MAP[findPart(parts, "weekday")] ?? 0,
  }
}

/**
 * Returns the UTC offset in minutes for a given instant in a timezone.
 * Positive means ahead of UTC (e.g., +60 for CET).
 */
export function getUtcOffsetMinutes(date: Date, timezone: string): number {
  const local = getDateParts(date, timezone)
  const utc = getDateParts(date, "UTC")

  const localEpoch = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  )
  const utcEpoch = Date.UTC(
    utc.year,
    utc.month - 1,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second
  )

  return Math.round((localEpoch - utcEpoch) / 60_000)
}

/**
 * Format a Date as "YYYY-MM-DD" in a specific timezone.
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const p = getDateParts(date, timezone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/**
 * Parse a time string ("HH:MM" or "HH:MM:SS") to minutes since midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr)
  if (!match) throw new Error(`Invalid time format: "${timeStr}"`)
  const hours = +match[1]!
  const mins = +match[2]!
  if (hours > 23 || mins > 59) {
    throw new Error(`Time out of range: "${timeStr}"`)
  }
  return hours * 60 + mins
}

/**
 * Create a UTC Date from a calendar date string and wall-clock time
 * in a specific timezone.
 *
 * @param dateStr - "YYYY-MM-DD"
 * @param minutes - minutes since midnight in the timezone
 * @param timezone - IANA timezone name
 */
export function createUtcFromLocalTime(
  dateStr: string,
  minutes: number,
  timezone: string
): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number]
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute))
  const offset = getUtcOffsetMinutes(guess, timezone)
  const adjusted = new Date(guess.getTime() - offset * 60_000)

  const verify = getDateParts(adjusted, timezone)
  if (
    verify.year !== y ||
    verify.month !== m ||
    verify.day !== d ||
    verify.hour !== hour ||
    verify.minute !== minute
  ) {
    const expectedEpoch = Date.UTC(y, m - 1, d, hour, minute)
    const actualEpoch = Date.UTC(
      verify.year,
      verify.month - 1,
      verify.day,
      verify.hour,
      verify.minute
    )
    const correction = expectedEpoch - actualEpoch
    const corrected = new Date(adjusted.getTime() + correction)

    const recheck = getDateParts(corrected, timezone)
    if (
      recheck.year !== y ||
      recheck.month !== m ||
      recheck.day !== d ||
      recheck.hour !== hour ||
      recheck.minute !== minute
    ) {
      throw new RangeError(
        `Invalid or ambiguous local time: ${dateStr} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} in ${timezone}`
      )
    }

    return corrected
  }

  return adjusted
}

/**
 * Iterate calendar dates in a timezone between two UTC timestamps.
 * Yields "YYYY-MM-DD" strings.
 */
export function* iterateDays(
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string
): Generator<string> {
  const seen = new Set<string>()
  const ms = rangeStart.getTime()
  const end = rangeEnd.getTime()

  for (let t = ms; t <= end; t += 3_600_000) {
    const dateStr = formatDateInTimezone(new Date(t), timezone)
    if (!seen.has(dateStr)) {
      seen.add(dateStr)
      yield dateStr
    }
  }

  const endDateStr = formatDateInTimezone(rangeEnd, timezone)
  if (!seen.has(endDateStr)) {
    yield endDateStr
  }
}
