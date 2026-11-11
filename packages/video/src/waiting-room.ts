/**
 * Timing for the waiting room a person sees when they open a session's
 * join page before joining opens (15 minutes before the start) or after it
 * closed (30 minutes after the booked end). Pure functions; the screen is
 * `client/waiting-room.tsx`.
 */

export type JoinWindow = {
  /** Session start (epoch ms). */
  startsAt: number
  /** Joining opens (epoch ms). */
  opensAt: number
  /** Joining closes (epoch ms); `null` when the API did not say. */
  closesAt: number | null
  /**
   * Server time minus device time (ms) when the API answered. Added to the
   * device clock so a wrong clock cannot open the door early or late.
   */
  skewMs: number
}

export type WaitingPhase = "early" | "opening" | "ended"

/** Times outside this range are treated as a broken answer, not shown. */
const EARLIEST = Date.UTC(2020, 0, 1)
const LATEST = Date.UTC(2100, 0, 1)

function parse(value: string | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) && time >= EARLIEST && time <= LATEST
    ? time
    : null
}

/** Read the `SESSION_NOT_OPEN` details; `null` when they cannot be used. */
export function readJoinWindow(
  details: {
    startsAt?: string
    opensAt?: string
    closesAt?: string
    now?: string
  },
  deviceNow: number
): JoinWindow | null {
  const startsAt = parse(details.startsAt)
  const opensAt = parse(details.opensAt)
  if (startsAt === null || opensAt === null || opensAt > startsAt) return null
  const closesAt = parse(details.closesAt)
  const serverNow = parse(details.now)
  return {
    startsAt,
    opensAt,
    closesAt: closesAt !== null && closesAt > startsAt ? closesAt : null,
    skewMs: serverNow === null ? 0 : serverNow - deviceNow,
  }
}

/** The server's clock, as best the device can tell. */
export function serverTime(window: JoinWindow, deviceNow: number): number {
  return deviceNow + window.skewMs
}

export function waitingPhase(
  window: JoinWindow,
  deviceNow: number
): WaitingPhase {
  const now = serverTime(window, deviceNow)
  if (now < window.opensAt) return "early"
  if (window.closesAt !== null && now > window.closesAt) return "ended"
  return "opening"
}

/** Whole minutes until joining opens, rounded up; 0 once it is open. */
export function minutesUntilOpen(
  window: JoinWindow,
  deviceNow: number
): number {
  const left = window.opensAt - serverTime(window, deviceNow)
  return left <= 0 ? 0 : Math.ceil(left / 60_000)
}

/**
 * Pauses between automatic tries once joining should be open. After the
 * last one the screen offers a button instead of asking again.
 */
export const AUTO_JOIN_PAUSES_MS = [500, 3_000, 6_000, 12_000, 20_000] as const

/** The first try is spread over this long, so not everyone asks at once. */
export const AUTO_JOIN_SPREAD_MS = 1_500

/**
 * Pause before automatic try number `attempt` (from 0), or `null` when
 * the tries are used up. `spread` is a number in [0, 1) drawn once per
 * waiting room: it staggers the first try of the two people in a session,
 * and of the many sessions that open on the hour.
 */
export function autoJoinDelay(attempt: number, spread = 0): number | null {
  const pause = AUTO_JOIN_PAUSES_MS[attempt]
  if (pause === undefined) return null
  return attempt === 0
    ? pause + Math.floor(spread * AUTO_JOIN_SPREAD_MS)
    : pause
}

/** What one try found. `rate_limited`: the server asked us to slow down. */
export type OpenAttempt = "joined" | "not_open" | "failed" | "rate_limited"

/**
 * How many automatic tries are used up after `result`. A rate limit uses
 * them all, so the screen stops asking and offers its button.
 */
export function attemptsAfter(result: OpenAttempt, attempt: number): number {
  if (result === "joined") return attempt
  if (result === "rate_limited") return AUTO_JOIN_PAUSES_MS.length
  return Math.min(attempt + 1, AUTO_JOIN_PAUSES_MS.length)
}

/**
 * Whether a failed try is worth repeating, from the HTTP status of the
 * answer (`undefined`: no answer, the connection dropped). A server that
 * is busy or unreachable usually recovers; anything else it said is final.
 */
export function retryableJoinFailure(
  status: number | undefined
): "retry" | "rate_limited" | "final" {
  if (status === undefined) return "retry"
  if (status === 429) return "rate_limited"
  return status >= 500 ? "retry" : "final"
}

/** True when the session starts on a later calendar day in the viewer's zone. */
export function startsAnotherDay(
  window: JoinWindow,
  deviceNow: number,
  timeZone?: string
): boolean {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return (
    day.format(new Date(window.startsAt)) !==
    day.format(new Date(serverTime(window, deviceNow)))
  )
}
