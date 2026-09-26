export const PAID_EXPERT = "fisiomota"
export const PAID_OFFER = "first-visit"
export const PAID_PRICE_CENTS = 6000

export const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3001"
export const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function isLoopbackHost(host: string): boolean {
  const normalized = host.replace(/^\[(.*)\]$/, "$1").toLowerCase()
  return LOOPBACK_HOSTS.has(normalized)
}

/** True when any configured e2e URL is not loopback (including invalid URLs). */
export function isNonLoopbackE2eTarget(): boolean {
  if (process.env.VERCEL_ENV === "production") return true
  const urls = [
    process.env.E2E_BASE_URL ?? webUrl,
    process.env.E2E_API_URL ?? "http://localhost:3002",
    process.env.E2E_ACCOUNT_URL ?? "http://localhost:3006",
    process.env.E2E_APP_URL ?? appUrl,
  ]
  for (const raw of urls) {
    try {
      if (!isLoopbackHost(new URL(raw).hostname)) return true
    } catch {
      return true
    }
  }
  return false
}

/** Direct SQL e2e writes must not target production or a remote DB while API is loopback. */
export function isApprovedE2eDatabaseUrl(
  databaseUrl = process.env.DATABASE_URL
): boolean {
  if (!databaseUrl) return false
  if (process.env.VERCEL_ENV === "production") return false
  if (process.env.NODE_ENV === "production") return false
  if (process.env.E2E_ALLOW_DB_WRITES !== "1") return false
  if (isNonLoopbackE2eTarget()) return false
  const hostMatch = databaseUrl.match(/@([^/?]+)/)
  const host = hostMatch?.[1]?.split(":")[0]?.toLowerCase() ?? ""
  if (isLoopbackHost(host)) return true
  // Local dev Neon branches (pooler or direct) while stack is loopback-only.
  if (host.endsWith(".neon.tech")) return true
  return false
}
