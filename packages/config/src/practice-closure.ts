/**
 * Closing an expert practice (ADR-026 decision 10). Stable codes shared by
 * the domain (`@eleva/auth`), the readiness query (`@eleva/db`), the API and
 * its typed client, so agents and the UI branch on the same values.
 */

/** What still has to finish before an expert can close a practice. */
export const PRACTICE_CLOSURE_BLOCKER_CODES = [
  "FUTURE_BOOKINGS",
  "PENDING_REFUNDS",
  "OPEN_DISPUTES",
  "UNSETTLED_PAYOUTS",
  "UNPAID_SUBSCRIPTION",
] as const

export type PracticeClosureBlockerCode =
  (typeof PRACTICE_CLOSURE_BLOCKER_CODES)[number]

export interface PracticeClosureBlocker {
  code: PracticeClosureBlockerCode
  count: number
}

/** Why a close or reopen request was refused. */
export const PRACTICE_CLOSURE_ERROR_CODES = [
  "PRACTICE_NOT_FOUND",
  "PRACTICE_OWNER_REQUIRED",
  "CLOSURE_CONFIRMATION_MISMATCH",
  "PRACTICE_CLOSURE_BLOCKED",
  "PRACTICE_ALREADY_CLOSED",
  "PRACTICE_NOT_CLOSED",
  "STEP_UP_REQUIRED",
] as const

export type PracticeClosureErrorCode =
  (typeof PRACTICE_CLOSURE_ERROR_CODES)[number]

/**
 * Closing needs a recent sign-in, not only a valid session (step-up): the
 * session must have started within this window.
 */
export const CLOSURE_RECENT_SIGN_IN_MS = 15 * 60 * 1000

/**
 * True when the session started within the step-up window. A null sign-in
 * moment (JWTs, API keys) never passes.
 */
export function isRecentSignIn(
  authenticatedAt: Date | null,
  now: Date = new Date(),
  maxAgeMs: number = CLOSURE_RECENT_SIGN_IN_MS
): boolean {
  if (!authenticatedAt) return false
  const age = now.getTime() - authenticatedAt.getTime()
  return age >= 0 && age <= maxAgeMs
}

/** The public profile of a closed practice answers 410 with this code. */
export const PRACTICE_CLOSED = "PRACTICE_CLOSED" as const
