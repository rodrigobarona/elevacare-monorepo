import {
  requireApiAuth as requireBetterAuth,
  requireRevocableApiAuth,
  type ApiIdentity,
} from "@eleva/auth/api-auth"
import { expiredSessionCookies } from "@eleva/auth/api-auth"
import { UnauthorizedError, type ElevaSession } from "@eleva/auth"
import { secureJson } from "@/lib/security-headers"

export type { ApiIdentity }

export type ApiAuthResult =
  | { type: "session"; session: ElevaSession }
  | { type: "bearer"; session: ElevaSession }
  | { type: "anonymous" }

export async function resolveApiAuth(request: Request): Promise<ApiAuthResult> {
  try {
    const session = await requireBetterAuth(request)
    if (session.authMode === "cookie") {
      return { type: "session", session }
    }
    return { type: "bearer", session }
  } catch (err) {
    if (err instanceof UnauthorizedError && err.code === "no-session") {
      return { type: "anonymous" }
    }
    throw err
  }
}

export async function requireApiAuth(request: Request): Promise<ElevaSession> {
  return requireBetterAuth(request)
}

/** Member-app `/me` routes: session plus personal-Space product label. */
export async function requireMemberApiAuth(
  request: Request
): Promise<ElevaSession> {
  const session = await requireApiAuth(request)
  if (session.productLabel !== "member") {
    throw new UnauthorizedError("missing-capability", "member product required")
  }
  return session
}

export async function requirePrivilegedApiAuth(
  request: Request
): Promise<ElevaSession> {
  return requireRevocableApiAuth(request)
}

export async function requireApiCapability(
  request: Request,
  capability: string
): Promise<ElevaSession> {
  const session = await requireApiAuth(request)
  if (!session.capabilities.includes(capability)) {
    throw new UnauthorizedError("missing-capability", `missing: ${capability}`)
  }
  return session
}

export function apiAuthFailure(
  err: unknown,
  headers: Record<string, string>
): Response | null {
  if (err instanceof UnauthorizedError) {
    if (err.code === "ambiguous-credentials") {
      return secureJson(
        { error: "bad_request", code: "AMBIGUOUS_CREDENTIALS" },
        { status: 400, headers }
      )
    }
    if (err.code === "session-cookie-ambiguous") {
      console.warn(
        "[auth] SESSION_COOKIE_AMBIGUOUS: duplicate session cookie rejected"
      )
      const response = secureJson(
        { error: "unauthorized", code: "SESSION_COOKIE_AMBIGUOUS" },
        { status: 401, headers }
      )
      for (const cookie of expiredSessionCookies()) {
        response.headers.append("Set-Cookie", cookie)
      }
      return response
    }
    if (err.code === "csrf-origin-mismatch") {
      return secureJson(
        { error: "forbidden", code: "CSRF_ORIGIN_MISMATCH" },
        { status: 403, headers }
      )
    }
    if (err.code === "jwt-not-revocable") {
      return secureJson(
        { error: "forbidden", code: err.code },
        { status: 403, headers }
      )
    }
    const forbidden =
      err.code === "missing-capability" || err.code === "not-a-member"
    return secureJson(
      { error: forbidden ? "forbidden" : "unauthorized", code: err.code },
      { status: forbidden ? 403 : 401, headers }
    )
  }
  return null
}
