import { isTrustedOrigin } from "../trusted-origins"
import { UnauthorizedError } from "../types"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * Cookie-authenticated mutations must be same-site or from an explicit
 * trusted origin. Bearer and API-key callers skip this check.
 */
export function assertCookieCsrf(request: Request): void {
  const method = request.method.toUpperCase()
  if (SAFE_METHODS.has(method)) return

  const origin = request.headers.get("origin")
  const secFetchSite = request.headers.get("sec-fetch-site")

  if (secFetchSite === "cross-site") {
    throw new UnauthorizedError("csrf-origin-mismatch", "CSRF_ORIGIN_MISMATCH")
  }
  if (origin && !isTrustedOrigin(origin)) {
    throw new UnauthorizedError("csrf-origin-mismatch", "CSRF_ORIGIN_MISMATCH")
  }
  if (
    !origin &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "same-site"
  ) {
    throw new UnauthorizedError("csrf-origin-mismatch", "CSRF_ORIGIN_MISMATCH")
  }
}
