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
  // Staging gateway (today the v3 production deployment).
  "dev.eleva.care",
  "localhost",
])

const GATEWAY_AUTH_PATHS = [
  "/dashboard",
  "/verify-email",
  "/callback",
  "/two-factor",
  "/login",
  "/signup",
  "/accept-invitation",
] as const

function isGatewayAuthPath(path: string): boolean {
  return GATEWAY_AUTH_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`)
  )
}

// Backslash, ASCII control characters (incl. tab, CR, LF) and DEL.
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\\\u0000-\u001f\u007f]/

/** Resolve a path the way a browser would and keep it only if it stays on-site. */
function sameOriginPath(path: string): string | undefined {
  const probe = "https://return-to.invalid"
  try {
    const url = new URL(path, probe)
    if (url.origin !== probe) return undefined
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}

function relativeFromAbsoluteUrl(url: URL): string | undefined {
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
}

export function sanitizeReturnTo(
  raw: string | null | undefined
): string | undefined {
  if (!raw) return undefined

  try {
    return relativeFromAbsoluteUrl(new URL(raw))
  } catch {
    // Percent-encoded relative paths still need a decode pass.
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return undefined
  }

  if (decoded.startsWith("/")) {
    if (decoded.startsWith("//")) return undefined
    if (decoded.includes("://")) return undefined
    // Browsers read "\" as "/" and drop tabs and newlines, so "/\evil.com"
    // or "/<tab>/evil.com" would become the off-site "//evil.com".
    if (UNSAFE_PATH_CHARS.test(decoded)) return undefined
    return sameOriginPath(decoded)
  }

  try {
    return relativeFromAbsoluteUrl(new URL(decoded))
  } catch {
    return undefined
  }
}

/**
 * The staff console has its own address (`admin.eleva.care`), so a page on
 * it cannot be a `returnTo`: those resolve against the gateway. A console
 * page is named by its path alone, as `/dashboard?console=<path>`, and the
 * gateway's `/dashboard` joins that path to the console's address from the
 * server's own configuration. Nothing a link carries can change the host.
 */
const CONSOLE_PARAM = "console"

// Letters, digits and the plain marks of a path, then an optional query of
// the same (no `&`: one parameter survives the trip, which is what the
// console's addresses have).
const CONSOLE_PATH = /^\/[A-Za-z0-9._~\-/]*(?:\?[A-Za-z0-9._~\-=]*)?$/

/** The `returnTo` that brings a person back to `path` on the staff console. */
export function consoleReturnTo(path: string): string {
  return `/dashboard?${CONSOLE_PARAM}=${encodeURIComponent(path)}`
}

/**
 * The console path a `/dashboard?console=` request names, or undefined for
 * anything that is not a plain path on it.
 */
export function consoleReturnPath(
  raw: string | null | undefined
): string | undefined {
  if (!raw || raw.length > 512 || !CONSOLE_PATH.test(raw)) return undefined
  const [path = ""] = raw.split("?")
  if (path.includes("//") || path.split("/").includes("..")) return undefined
  return raw
}

/** The query parameter `/dashboard` reads a console path from. */
export const CONSOLE_RETURN_PARAM = CONSOLE_PARAM

/** True when `raw` is a relative path we would keep, or an absolute URL on the gateway origin. */
export function isTrustedReturnTo(
  raw: string | null | undefined,
  gateway = resolveGatewayUrl()
): boolean {
  if (!raw) return false
  try {
    if (new URL(raw).origin === new URL(gateway).origin) return true
  } catch {
    // Relative or invalid — fall through to the path sanitizer.
  }
  return sanitizeReturnTo(raw) !== undefined
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
  const base = gateway.replace(/\/$/, "")
  if (returnTo) {
    try {
      const candidate = new URL(returnTo)
      if (candidate.origin === new URL(base).origin) {
        return candidate.toString()
      }
    } catch {
      // Relative or invalid — sanitize below.
    }
  }
  const path = sanitizeReturnTo(returnTo) ?? "/dashboard"
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
