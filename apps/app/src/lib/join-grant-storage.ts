const STORAGE_PREFIX = "eleva:join-grant:v1:"

function storageKey(bookingId: string): string {
  return `${STORAGE_PREFIX}${bookingId}`
}

function jwtExpUnix(grant: string): number | null {
  const payload = grant.split(".")[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const parsed = JSON.parse(json) as { exp?: unknown }
    return typeof parsed.exp === "number" ? parsed.exp : null
  } catch {
    return null
  }
}

export function isJoinGrantExpired(grant: string, nowMs = Date.now()): boolean {
  const exp = jwtExpUnix(grant)
  return exp !== null && exp * 1000 <= nowMs
}

export function readJoinGrant(bookingId: string): string | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const stored = sessionStorage.getItem(storageKey(bookingId))
    if (!stored) return null
    if (isJoinGrantExpired(stored)) {
      sessionStorage.removeItem(storageKey(bookingId))
      return null
    }
    return stored
  } catch {
    return null
  }
}

export function writeJoinGrant(bookingId: string, grant: string): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(storageKey(bookingId), grant)
  } catch {
    // Private mode / quota: keep the in-memory grant from the URL.
  }
}

export function clearJoinGrant(bookingId: string): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.removeItem(storageKey(bookingId))
  } catch {
    // Ignore storage failures on clear.
  }
}

export function stripJoinGrantFromUrl(): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has("g")) return
  url.searchParams.delete("g")
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, "", next)
}
