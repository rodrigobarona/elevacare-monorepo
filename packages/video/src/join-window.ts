export const JOIN_LEAD_MS = 15 * 60 * 1000
export const JOIN_TRAIL_MS = 30 * 60 * 1000

const JOINABLE_STATUSES = new Set(["confirmed", "rescheduled"])

export function isJoinWindowOpen(
  startsAt: Date,
  endsAt: Date,
  now: Date = new Date()
): boolean {
  const t = now.getTime()
  return (
    t >= startsAt.getTime() - JOIN_LEAD_MS &&
    t <= endsAt.getTime() + JOIN_TRAIL_MS
  )
}

export function isJoinCtaEnabled(input: {
  sessionMode: string
  status: string
  startsAt: Date | string
  endsAt: Date | string
  now?: Date
}): boolean {
  if (input.sessionMode !== "online") return false
  if (!JOINABLE_STATUSES.has(input.status)) return false
  return isJoinWindowOpen(
    new Date(input.startsAt),
    new Date(input.endsAt),
    input.now
  )
}
