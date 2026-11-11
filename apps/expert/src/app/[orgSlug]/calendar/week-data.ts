/**
 * What the calendar shows for the week on screen, from what has been
 * loaded so far. Pure, so the rules are tested without a browser.
 */

/** One booking as the calendar shows it: only these fields reach the browser. */
export type CalendarBooking = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  sessionMode: "online" | "in_person" | "phone"
  memberFirstName: string | null
  approvalDeadlineAt: string | null
  eventTypeTitle: { en: string; pt?: string; es?: string }
  modeLabel: { en: string; pt?: string; es?: string } | null
  locationName: string | null
  locationCity: string | null
  locationCountry: string | null
}

export type LoadedWeek<T> = { key: string; bookings: T[] }

/** Requests answered on this page, until the week is loaded again. */
export type Settled = Record<string, "confirmed" | "cancelled">

export type WeekData<T> = {
  /** The last load of this week failed. */
  failed: boolean
  /** No answer yet for this week: show a placeholder, never an empty week. */
  loading: boolean
  /**
   * This week has been loaded at least once. It stays on screen when a
   * later reload fails (a phone waking before its network is back).
   */
  hasWeek: boolean
  bookings: T[]
}

export function weekRangeKey(fromIso: string, toIso: string): string {
  return `${fromIso}|${toIso}`
}

export function weekData<T extends { id: string; status: string }>(input: {
  rangeKey: string
  loaded: LoadedWeek<T> | null
  failedKey: string | null
  settled: Settled
}): WeekData<T> {
  const { rangeKey, loaded, failedKey, settled } = input
  // An answer for another week (the expert has moved on) is not this week's.
  const current = loaded?.key === rangeKey ? loaded.bookings : null
  const failed = failedKey === rangeKey
  return {
    failed,
    // A week already on screen stays there while it is loaded again.
    loading: !failed && current === null,
    hasWeek: current !== null,
    bookings: (current ?? [])
      .filter((booking) => settled[booking.id] !== "cancelled")
      .map((booking) =>
        settled[booking.id] === "confirmed"
          ? { ...booking, status: "confirmed" }
          : booking
      ),
  }
}

/** How a session is shown: a request, an unpaid hold, or a session. */
export type SessionKind = "request" | "unpaid" | "session"

const UNPAID_STATUSES = new Set([
  "slot_reserved",
  "awaiting_payment",
  "reserved",
  "pending_payment",
])

export function sessionKind(status: string): SessionKind {
  if (status === "awaiting_confirmation") return "request"
  return UNPAID_STATUSES.has(status) ? "unpaid" : "session"
}

/** The open week is loaded again when the expert comes back after this long. */
export const REFRESH_AFTER_MS = 60_000

export function shouldRefreshOnReturn(input: {
  visible: boolean
  lastLoadedAt: number | null
  now: number
}): boolean {
  if (!input.visible || input.lastLoadedAt === null) return false
  return input.now - input.lastLoadedAt >= REFRESH_AFTER_MS
}
