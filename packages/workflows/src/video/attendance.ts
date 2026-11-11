export type SessionAttendance =
  | "both"
  | "expert_only"
  | "member_only"
  | "nobody"

export type SessionParticipantHistory = {
  role: "expert" | "member" | "delegate" | "supervisor"
  userId?: string
  joinedAt: string
  leftAt?: string
}

type Presence = Pick<SessionParticipantHistory, "role" | "joinedAt" | "leftAt">

/** The booked time of a session. */
export type BookedTime = { start: Date; end: Date }

type Interval = { from: number; to: number }

/**
 * When each `role` was in the room. A visit with no leave time yet lasts
 * until `asOf` (the moment of the decision), never longer: two people who
 * have just come together have not yet been together for two minutes.
 */
function intervals(
  history: Presence[],
  role: Presence["role"],
  asOf: Date
): Interval[] {
  const until = asOf.getTime()
  return history.flatMap((row) => {
    if (row.role !== role) return []
    const from = Date.parse(row.joinedAt)
    if (!Number.isFinite(from)) return []
    const to = row.leftAt ? Date.parse(row.leftAt) : Math.max(from, until)
    // A leave time we cannot read counts as no time in the room.
    return [{ from, to: Number.isNaN(to) ? from : to }]
  })
}

/** Time `role` spent in the room inside the booked time (ms). */
function presenceInside(rows: Interval[], booked: BookedTime): number {
  const start = booked.start.getTime()
  const end = booked.end.getTime()
  return rows.reduce((total, row) => {
    const span = Math.min(row.to, end) - Math.max(row.from, start)
    return total + Math.max(0, span)
  }, 0)
}

/** Time expert and member spent in the room together (ms). */
function timeTogether(experts: Interval[], members: Interval[]): number {
  let total = 0
  for (const expert of experts) {
    for (const member of members) {
      const span =
        Math.min(expert.to, member.to) - Math.max(expert.from, member.from)
      if (span > 0) total += span
    }
  }
  return total
}

/**
 * How long two people must have been in the room together to have met.
 * Shorter than this is a look into the room, not a session.
 */
export const MET_MIN_TOGETHER_MS = 2 * 60 * 1000

/**
 * Who attended. `both` means the expert and the member were in the room
 * together for at least two minutes: two people who each came alone, or
 * an expert who only looked in, did not have a session, however the list
 * of joins looks.
 *
 * When they did not meet, one side is named only if the other spent no
 * time in the room during the booked time. If both were there during the
 * booked time and still missed each other, the record blames no one
 * (`nobody`): who waited for whom is for support to read from the history.
 */
export function deriveAttendance(
  history: Presence[],
  booked: BookedTime,
  /** The moment of the decision: visits still open last until then. */
  asOf: Date
): SessionAttendance {
  const experts = intervals(history, "expert", asOf)
  const members = intervals(history, "member", asOf)
  if (experts.length === 0 && members.length === 0) return "nobody"
  if (members.length === 0) return "expert_only"
  if (experts.length === 0) return "member_only"
  if (timeTogether(experts, members) >= MET_MIN_TOGETHER_MS) return "both"
  const expertTime = presenceInside(experts, booked)
  const memberTime = presenceInside(members, booked)
  if (expertTime > 0 && memberTime === 0) return "expert_only"
  if (memberTime > 0 && expertTime === 0) return "member_only"
  return "nobody"
}

export function statusAfterAttendance(
  attendance: SessionAttendance
): "ended" | "no_show" {
  return attendance === "both" ? "ended" : "no_show"
}

/**
 * When the room last emptied: the latest leave, once nobody is recorded
 * as still inside. `null` when someone is, or nobody ever left.
 */
export function lastLeftAt(history: Presence[]): Date | null {
  if (history.some((row) => !row.leftAt)) return null
  const times = history
    .map((row) => Date.parse(row.leftAt ?? ""))
    .filter((time) => Number.isFinite(time))
  return times.length > 0 ? new Date(Math.max(...times)) : null
}

/**
 * Daily says the room emptied at `at`, so nobody who had joined by then is
 * inside: give each of those visits still open that end. A lost "left"
 * event would otherwise leave someone in the room for ever and make them
 * "meet" whoever comes next. A visit that began after `at` (events can
 * arrive out of order) is a later one and stays open.
 */
export function closeOpenPresence<Row extends Presence>(
  history: Row[],
  at: Date
): Row[] {
  const leftAt = at.toISOString()
  const emptiedAt = at.getTime()
  const stillOpen = (row: Row) =>
    !row.leftAt && Date.parse(row.joinedAt) <= emptiedAt
  if (!history.some(stillOpen)) return history
  return history.map((row) => (stillOpen(row) ? { ...row, leftAt } : row))
}

/**
 * What Daily's `meeting.ended` does to a session. Daily sends it shortly
 * after the last person leaves the room, whenever that is.
 *
 * It closes the session only when the session happened: the booked end
 * has passed and the two people met. Otherwise the room has only emptied.
 * An expert who checked the room early, both people dropping on a bad
 * connection, or one person who waited alone and left: any of them must
 * be able to come back, so the session returns to `scheduled` and stays
 * joinable. A no-show is never declared here; the attendance sweep
 * declares it when the join window closes (`attendance-fallback.ts`).
 */
export function afterMeetingEnded<Status extends string>(input: {
  status: Status
  participants: Presence[]
  at: Date
  booked: BookedTime
}):
  | { final: false; status: Status | "scheduled" }
  | { final: true; status: "ended"; attendance: "both" } {
  if (input.status !== "scheduled" && input.status !== "live") {
    return { final: false, status: input.status }
  }
  if (
    input.at.getTime() >= input.booked.end.getTime() &&
    deriveAttendance(input.participants, input.booked, input.at) === "both"
  ) {
    return { final: true, status: "ended", attendance: "both" }
  }
  return { final: false, status: "scheduled" }
}

/** A session row as far as Daily's lifecycle events are concerned. */
export type LifecycleSession<
  Status extends string,
  Row extends Presence = Presence,
> = {
  status: Status
  startedAt: Date | null
  endedAt: Date | null
  lastEventAt: Date | null
  participants: Row[]
  booked: BookedTime
}

/**
 * Apply `meeting.started` or `meeting.ended` to a session. An event older
 * than the last one applied changes nothing (Daily can deliver late).
 */
export function nextLifecycleState<
  Status extends string,
  Row extends Presence = Presence,
>(
  session: LifecycleSession<Status, Row>,
  event: { type: string; at: Date }
): {
  status: Status | "live" | "scheduled" | "ended"
  startedAt: Date | null
  endedAt: Date | null
  lastEventAt: Date | null
  participants: Row[]
  /** Set when this event closed the session. */
  attendance: SessionAttendance | null
} {
  const unchanged = {
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastEventAt: session.lastEventAt,
    participants: session.participants,
    attendance: null,
  }
  if (!shouldApplyEvent(session.lastEventAt, event.at)) return unchanged
  const applied = { ...unchanged, lastEventAt: event.at }

  if (event.type === "meeting.started") {
    if (
      session.status !== "scheduled" &&
      session.status !== "room_unresolved"
    ) {
      return applied
    }
    // Keep the first start when people come back to an emptied room.
    return {
      ...applied,
      status: "live",
      startedAt: session.startedAt ?? event.at,
    }
  }

  if (event.type === "meeting.ended") {
    const participants = closeOpenPresence(session.participants, event.at)
    const next = afterMeetingEnded({
      status: session.status,
      participants,
      at: event.at,
      booked: session.booked,
    })
    return next.final
      ? {
          ...applied,
          participants,
          status: next.status,
          endedAt: event.at,
          attendance: next.attendance,
        }
      : { ...applied, participants, status: next.status }
  }

  return applied
}

export function appendParticipantHistory(
  history: SessionParticipantHistory[],
  event: {
    role: SessionParticipantHistory["role"]
    userId?: string
    at: Date
    kind: "joined" | "left"
  }
): SessionParticipantHistory[] {
  if (event.kind === "joined") {
    return [
      ...history,
      {
        role: event.role,
        userId: event.userId,
        joinedAt: event.at.toISOString(),
      },
    ]
  }
  const next = history.map((row) => ({ ...row }))
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const row = next[i]
    if (!row || row.leftAt) continue
    if (event.userId && row.userId && row.userId !== event.userId) continue
    if (row.role !== event.role && event.userId && !row.userId) continue
    if (!event.userId && row.role !== event.role) continue
    next[i] = { ...row, leftAt: event.at.toISOString() }
    break
  }
  return next
}

/** How far ahead of our clock an event time may be before it is distrusted. */
const EVENT_TIME_SKEW_MS = 5 * 60 * 1000

/**
 * The time Daily says an event happened. A missing or unusable value, or
 * one further ahead than clocks can drift, falls back to when we received
 * it, so a wrong timestamp can never close a session early or block the
 * events that follow it.
 */
export function eventTimeFromDaily(
  eventTs: number | undefined,
  fallback: Date
) {
  if (eventTs == null || !Number.isFinite(eventTs)) return fallback
  const ms = eventTs > 1e12 ? eventTs : eventTs * 1000
  if (ms > fallback.getTime() + EVENT_TIME_SKEW_MS) return fallback
  return new Date(ms)
}

export function shouldApplyEvent(
  lastEventAt: Date | null,
  incoming: Date
): boolean {
  if (!lastEventAt) return true
  return incoming.getTime() > lastEventAt.getTime()
}
