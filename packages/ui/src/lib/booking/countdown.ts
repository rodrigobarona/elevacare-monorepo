export function remainingMs(expiresAt: string, nowMs = Date.now()): number {
  const target = new Date(expiresAt).getTime()
  if (!Number.isFinite(target)) return 0
  return Math.max(0, target - nowMs)
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function isExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return remainingMs(expiresAt, nowMs) === 0
}
