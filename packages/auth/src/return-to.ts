/**
 * Shared `returnTo` sanitizer for the WorkOS auth flow.
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
    return relative || "/"
  } catch {
    return undefined
  }
}
