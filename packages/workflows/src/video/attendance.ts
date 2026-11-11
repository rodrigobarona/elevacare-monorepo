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

/** When each `role` was in the room; still there counts as "until now". */
function intervals(history: Presence[], role: Presence["role"]): Interval[] {
  return history.flatMap((row) => {
    if (row.role !== role) return []
    const from = Date.parse(row.joinedAt)
    if (!Number.isFinite(from)) return []
    const to = row.leftAt ? Date.parse(row.leftAt) : Number.POSITIVE_INFINITY
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

/**
 * Who attended. `both` means the expert and the member were in the room
 * at the same time: two people who each came alone never met, however
 * the record of joins looks.
 *
 * When both came but never together, the one who spent longer in the room
 * during the booked time is the one who attended (an expert who looked in
 * before the start and left does not count against a member who waited).
 * Equal, or neither inside the booked time: `nobody`.
 */
export function deriveAttendance(
  history: Presence[],
  booked: BookedTime
): SessionAttendance {
  const experts = intervals(history, "expert")
  const members = intervals(history, "member")
  if (experts.length === 0 && members.length === 0) return "nobody"
  if (members.length === 0) return "expert_only"
  if (experts.length === 0) return "member_only"
  const met = experts.some((expert) =>
    members.some((member) => expert.from < member.to && member.from < expert.to)
  )
  if (met) return "both"
  const expertTime = presenceInside(experts, booked)
  const memberTime = presenceInside(members, booked)
  if (expertTime > memberTime) return "expert_only"
  if (memberTime > expertTime) return "member_only"
  return "nobody"
}

export function statusAfterAttendance(
  attendance: SessionAttendance
): "ended" | "no_show" {
  return attendance === "both" ? "ended" : "no_show"
}

/** When the last person left, if anyone was ever recorded leaving. */
export function lastLeftAt(history: Presence[]): Date | null {
  const times = history
    .map((row) => (row.leftAt ? Date.parse(row.leftAt) : Number.NaN))
    .filter((time) => Number.isFinite(time))
  return times.length > 0 ? new Date(Math.max(...times)) : null
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
    deriveAttendance(input.participants, input.booked) === "both"
  ) {
    return { final: true, status: "ended", attendance: "both" }
  }
  return { final: false, status: "scheduled" }
}

/** A session row as far as Daily's lifecycle events are concerned. */
export type LifecycleSession<Status extends string> = {
  status: Status
  startedAt: Date | null
  endedAt: Date | null
  lastEventAt: Date | null
  participants: Presence[]
  booked: BookedTime
}

/**
 * Apply `meeting.started` or `meeting.ended` to a session. An event older
 * than the last one applied changes nothing (Daily can deliver late).
 */
export function nextLifecycleState<Status extends string>(
  session: LifecycleSession<Status>,
  event: { type: string; at: Date }
): {
  status: Status | "live" | "scheduled" | "ended"
  startedAt: Date | null
  endedAt: Date | null
  lastEventAt: Date | null
  /** Set when this event closed the session. */
  attendance: SessionAttendance | null
} {
  const unchanged = {
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    lastEventAt: session.lastEventAt,
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
    const next = afterMeetingEnded({
      status: session.status,
      participants: session.participants,
      at: event.at,
      booked: session.booked,
    })
    return next.final
      ? {
          ...applied,
          status: next.status,
          endedAt: event.at,
          attendance: next.attendance,
        }
      : { ...applied, status: next.status }
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
