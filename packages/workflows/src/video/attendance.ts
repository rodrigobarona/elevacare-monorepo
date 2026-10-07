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
  return incoming.getTime() >= lastEventAt.getTime()
}
