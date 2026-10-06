export type QuietHours = {
  start: string
  end: string
  timezone: string | null
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

/**
 * Quiet hours are stored on every preference row. A complete SMS row wins
 * because quiet hours only gate SMS; otherwise the first complete row.
 */
export function quietHoursFrom(
  rows: ReadonlyArray<{
    channel?: string
    quietHoursStart?: string | null
    quietHoursEnd?: string | null
    timezone?: string | null
  }>
): QuietHours | null {
  const complete = rows.filter((r) => r.quietHoursStart && r.quietHoursEnd)
  const row = complete.find((r) => r.channel === "sms") ?? complete[0]
  if (!row?.quietHoursStart || !row.quietHoursEnd) return null
  return {
    start: row.quietHoursStart,
    end: row.quietHoursEnd,
    timezone: row.timezone ?? null,
  }
}

/**
 * Evaluates the window in the member's timezone (UTC when unknown or
 * invalid). Windows may wrap midnight; start === end is an empty window.
 */
export function isWithinQuietHours(quiet: QuietHours, now: Date): boolean {
  const start = minutesOf(quiet.start)
  const end = minutesOf(quiet.end)
  if (start === null || end === null || start === end) return false
  const local = localMinutes(now, quiet.timezone)
  return start < end
    ? local >= start && local < end
    : local >= start || local < end
}

function minutesOf(value: string): number | null {
  const match = TIME.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function localMinutes(now: Date, timezone: string | null): number {
  try {
    return minutesInZone(now, timezone ?? "UTC")
  } catch {
    return minutesInZone(now, "UTC")
  }
}

function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return (hour % 24) * 60 + minute
}
