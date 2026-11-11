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

export function deriveAttendance(
  history: Pick<SessionParticipantHistory, "role">[]
): SessionAttendance {
  const expert = history.some((row) => row.role === "expert")
  const member = history.some((row) => row.role === "member")
  if (expert && member) return "both"
  if (expert) return "expert_only"
  if (member) return "member_only"
  return "nobody"
}

export function statusAfterAttendance(
  attendance: SessionAttendance
): "ended" | "no_show" {
  return attendance === "both" ? "ended" : "no_show"
}

/**
 * What Daily's `meeting.ended` does to a session. Daily sends it shortly
 * after the last person leaves the room, whenever that is.
 *
 * Before the booked end the room has only emptied: an expert who checked
 * the room early, or both people dropping on a bad connection, must be
 * able to come back, so the session returns to `scheduled` and stays
 * joinable. Calling it `no_show` there would also free the slot for a new
 * booking. From the booked end on, an empty room means the session is
 * over and attendance decides `ended` or `no_show`.
 *
 * A session left open this way is closed by the attendance sweep when the
 * join window closes (`attendance-fallback.ts`).
 */
export function afterMeetingEnded<Status extends string>(input: {
  status: Status
  participants: Pick<SessionParticipantHistory, "role">[]
  at: Date
  bookedEnd: Date
}):
  | { final: false; status: Status | "scheduled" }
  | {
      final: true
      status: "ended" | "no_show"
      attendance: SessionAttendance
    } {
  if (input.status !== "scheduled" && input.status !== "live") {
    return { final: false, status: input.status }
  }
  if (input.at.getTime() < input.bookedEnd.getTime()) {
    return { final: false, status: "scheduled" }
  }
  const attendance = deriveAttendance(input.participants)
  return { final: true, status: statusAfterAttendance(attendance), attendance }
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

export function eventTimeFromDaily(
  eventTs: number | undefined,
  fallback: Date
) {
  if (eventTs == null || !Number.isFinite(eventTs)) return fallback
  const ms = eventTs > 1e12 ? eventTs : eventTs * 1000
  return new Date(ms)
}

export function shouldApplyEvent(
  lastEventAt: Date | null,
  incoming: Date
): boolean {
  if (!lastEventAt) return true
  return incoming.getTime() > lastEventAt.getTime()
}
