import {
  authWait,
  authWaitWords,
  type WaitMessages,
} from "@eleva/auth/rate-limited"

/**
 * Better Auth error codes → the security page's own messages, so a member
 * never reads the library's English text. Anything unknown is generic.
 */
export function authErrorKey(
  error: { code?: string | null } | null | undefined
): "errors.password" | "errors.code" | "error" {
  const code = error?.code ?? ""
  if (code.includes("PASSWORD")) return "errors.password"
  if (code.includes("CODE") || code.includes("OTP") || code.includes("TOTP")) {
    return "errors.code"
  }
  return "error"
}

/**
 * What a toast shows for a failed call in Security: the wait, when the
 * answer means "wait", otherwise the usual sentence for the kind of
 * error. A wait stays on the screen as long as the wait itself, up to a
 * minute: it holds a number to read, and nothing else on the page says it.
 */
export function securityError(
  error:
    | {
        code?: string | null
        status?: number
        retryAfter?: unknown
      }
    | null
    | undefined,
  tAuth: WaitMessages,
  tSecurity: (key: ReturnType<typeof authErrorKey>) => string
): [message: string, options: { duration?: number }] {
  const answer = error ? { ...error, code: error.code ?? undefined } : error
  const wait = authWait(answer)
  const words = authWaitWords(answer, tAuth)
  if (!wait || !words) return [tSecurity(authErrorKey(error)), {}]
  return [words, { duration: Math.min(wait.seconds ?? 60, 60) * 1000 }]
}
