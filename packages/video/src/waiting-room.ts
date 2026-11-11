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

/** setTimeout clamps delays above 2^31-1 ms to 0. */
export const MAX_TIMEOUT_MS = 2_147_483_647

function parse(value: string | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
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
 * Pauses between automatic tries once joining should be open. The first
 * try is spread over a second and a half so two people (and many sessions
 * on the hour) do not all ask at the same instant. After the last pause
 * the screen offers a button instead of asking again.
 */
export const AUTO_JOIN_PAUSES_MS = [500, 3_000, 6_000, 12_000, 20_000] as const

export function autoJoinDelay(
  attempt: number,
  random: () => number = Math.random
): number | null {
  const pause = AUTO_JOIN_PAUSES_MS[attempt]
  if (pause === undefined) return null
  return attempt === 0 ? pause + Math.floor(random() * 1_500) : pause
}

/** True when joining opens on a later calendar day in the viewer's zone. */
export function opensAnotherDay(
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
    day.format(new Date(window.opensAt)) !==
    day.format(new Date(serverTime(window, deviceNow)))
  )
}
