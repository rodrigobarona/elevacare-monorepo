/**
 * What a sign-in screen needs from a refusal that means "wait": how long.
 * Safe to import in a browser: it has no dependency.
 *
 * Two answers mean "wait":
 * - the rate limiter's (`./server/rate-limit-rules.ts`): HTTP 429 with the
 *   code `RATE_LIMITED` and `retryAfter` seconds in the body;
 * - the second step's lock, after ten wrong codes: HTTP 429 with the code
 *   `ACCOUNT_TEMPORARILY_LOCKED` and no time.
 */

/** The code of the rate limiter's refusal. It does not change. */
export const RATE_LIMITED_CODE = "RATE_LIMITED"

/**
 * How long Better Auth's second step locks an account after ten wrong
 * codes, in seconds: its default, which Eleva does not change. Its answer
 * carries no time, so the screens say this one.
 */
export const SECOND_STEP_LOCK_SECONDS = 15 * 60

/** No wait a screen shows is longer than this: an hour. */
const LONGEST_SHOWN = 60 * 60

export interface AuthWait {
  /** Seconds to wait, at most. Null when the answer did not say. */
  seconds: number | null
}

/**
 * Reads a failed auth call. Null when it is not an answer that means
 * "wait" (a wrong password, say).
 */
export function authWait(
  error:
    | { status?: number; code?: string; retryAfter?: unknown }
    | null
    | undefined
): AuthWait | null {
  if (error?.status !== 429) return null
  if (error.code === "ACCOUNT_TEMPORARILY_LOCKED") {
    return { seconds: SECOND_STEP_LOCK_SECONDS }
  }
  const seconds = Number(error.retryAfter)
  // A time that is missing, or that makes no sense, is not shown.
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > LONGEST_SHOWN) {
    return { seconds: null }
  }
  return { seconds: Math.ceil(seconds) }
}

/**
 * A wait as a person is told it: seconds under a minute, whole minutes
 * from there ("1 minute", not "60 seconds"), rounded up so that it is
 * never too short.
 */
export function waitForPeople(seconds: number): {
  unit: "seconds" | "minutes"
  count: number
} {
  if (seconds < 60) return { unit: "seconds", count: Math.ceil(seconds) }
  return { unit: "minutes", count: Math.ceil(seconds / 60) }
}

/** A translator of the sign-in messages: a key, and what goes in it. */
export type WaitMessages = (
  key: string,
  values?: Record<string, string | number>
) => string

/**
 * The sentence for an answer that means "wait": how long, and on the
 * sign-in screen that another way in still works. Null when the answer
 * is not one of those.
 *
 * One fixed sentence, with no number counting down: a screen reader says
 * it once, not once a second. The messages it uses: `waitSeconds`,
 * `waitMinutes` (both take `count`), `waitAFewMinutes`, `waitOtherWays`.
 */
export function authWaitWords(
  error: Parameters<typeof authWait>[0],
  t: WaitMessages,
  where: "signIn" | "elsewhere" = "elsewhere"
): string | null {
  const wait = authWait(error)
  if (!wait) return null
  let said: string
  if (wait.seconds === null) {
    said = t("waitAFewMinutes")
  } else {
    const { unit, count } = waitForPeople(wait.seconds)
    said = t(unit === "seconds" ? "waitSeconds" : "waitMinutes", { count })
  }
  // Each way of signing in is counted on its own, so the others work.
  return where === "signIn" ? `${said} ${t("waitOtherWays")}` : said
}
