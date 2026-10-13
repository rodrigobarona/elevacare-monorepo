import { resolveGatewayUrl } from "@eleva/config/env"

/**
 * Shared `returnTo` sanitizer for the Better Auth login flow.
 *
 * Used by:
 *   - apps/account/(auth)/login/route.ts        -> entry point
 *   - apps/account/(auth)/dashboard/page.tsx    -> post-callback redirect
 *
 * Open-redirect hardening:
 *   - Relative paths must start with `/` and must NOT be
 *     protocol-relative (`//host/...`) or contain a URL scheme
 *     (`://`).
 *   - Absolute URLs are allowed only when the hostname matches
 *     ABSOLUTE_RETURN_TO_HOSTS exactly (no subdomain wildcards).
 *     The path/query/hash is extracted and returned as a relative
 *     URL so the browser resolves against the current origin --
 *     this prevents an attacker from re-pointing the redirect
 *     even if their host somehow ends up in the allowlist.
 *
 * Returns `undefined` for any input that fails validation so
 * callers can fall through to a safe default destination.
 */

const ABSOLUTE_RETURN_TO_HOSTS = new Set<string>([
  "eleva.care",
  "www.eleva.care",
  "localhost",
])

const GATEWAY_AUTH_PATHS = [
  "/dashboard",
  "/verify-email",
  "/callback",
  "/two-factor",
  "/login",
  "/signup",
] as const

function isGatewayAuthPath(path: string): boolean {
  return GATEWAY_AUTH_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`)
  )
}

export function sanitizeReturnTo(
  raw: string | null | undefined
): string | undefined {
  if (!raw) return undefined

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return undefined
  }

  if (decoded.startsWith("/")) {
    if (decoded.startsWith("//")) return undefined
    if (decoded.includes("://")) return undefined
    return decoded
  }

  try {
    const url = new URL(decoded)
    if (!ABSOLUTE_RETURN_TO_HOSTS.has(url.hostname)) return undefined
    const relative = `${url.pathname}${url.search}${url.hash}`
    if (
      !relative ||
      !relative.startsWith("/") ||
      relative.startsWith("//") ||
      relative.includes("://")
    ) {
      return "/"
    }
    return relative
  } catch {
    return undefined
  }
}

/**
 * Absolute gateway URL for Better Auth `callbackURL`.
 *
 * Relative paths resolve against the auth server (`localhost:3002` /
 * `api.eleva.care`) and 404. Product destinations go through
 * `/dashboard?returnTo=` so the account zone can repair cookies and
 * bounce onto the gateway origin.
 */
export function toGatewayCallbackURL(
  returnTo?: string | null,
  gateway = resolveGatewayUrl()
): string {
  const path = sanitizeReturnTo(returnTo) ?? "/dashboard"
  const base = gateway.replace(/\/$/, "")
  if (isGatewayAuthPath(path)) return `${base}${path}`
  return `${base}/dashboard?returnTo=${encodeURIComponent(path)}`
}

const MAGIC_LINK_CALLBACK_KEYS = [
  "callbackURL",
  "newUserCallbackURL",
  "errorCallbackURL",
] as const

/**
 * Better Auth puts `callbackURL` on the API verify URL as-is. Relative
 * product paths then 404 on `localhost:3002` / `api.eleva.care` after
 * the session is minted. Rewrite those query params to gateway URLs
 * before the email is sent.
 */
export function rewriteMagicLinkVerifyUrl(
  url: string,
  gateway = resolveGatewayUrl()
): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  for (const key of MAGIC_LINK_CALLBACK_KEYS) {
    const raw = parsed.searchParams.get(key)
    if (!raw) continue
    parsed.searchParams.set(key, toGatewayCallbackURL(raw, gateway))
  }
  return parsed.toString()
}
