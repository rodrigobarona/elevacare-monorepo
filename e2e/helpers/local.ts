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
    process.env.E2E_BASE_URL,
    process.env.E2E_API_URL,
    process.env.E2E_ACCOUNT_URL,
    process.env.E2E_APP_URL,
    appUrl,
    webUrl,
  ]
  for (const raw of urls) {
    if (!raw) continue
    try {
      if (!isLoopbackHost(new URL(raw).hostname)) return true
    } catch {
      return true
    }
  }
  return false
}
