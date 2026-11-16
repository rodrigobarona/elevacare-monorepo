import { PracticeClosureError } from "@eleva/auth"
import type {
  PracticeClosureBlocker,
  PracticeClosureErrorCode,
} from "@eleva/config/practice-closure"
import { secureJson } from "@/lib/security-headers"

/** HTTP status for each closure refusal (ADR-026 decision 10). */
const STATUS: Record<PracticeClosureErrorCode, number> = {
  PRACTICE_NOT_FOUND: 404,
  PRACTICE_OWNER_REQUIRED: 403,
  STEP_UP_REQUIRED: 403,
  CLOSURE_CONFIRMATION_MISMATCH: 422,
  PRACTICE_CLOSURE_BLOCKED: 409,
  PRACTICE_ALREADY_CLOSED: 409,
  PRACTICE_NOT_CLOSED: 409,
}

export function practiceClosureError(
  code: PracticeClosureErrorCode,
  message: string,
  headers: Record<string, string>,
  blockers: PracticeClosureBlocker[] = []
): Response {
  return secureJson(
    {
      error: code,
      code,
      message,
      ...(blockers.length > 0 ? { blockers } : {}),
    },
    { status: STATUS[code], headers }
  )
}

/** The response for a domain refusal, or null for any other error. */
export function practiceClosureFailure(
  err: unknown,
  headers: Record<string, string>
): Response | null {
  if (!(err instanceof PracticeClosureError)) return null
  return practiceClosureError(err.code, err.message, headers, err.blockers)
}
