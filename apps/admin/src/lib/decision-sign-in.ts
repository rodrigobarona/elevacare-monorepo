import { LOGIN_PATH } from "@eleva/auth"
import { getSessionStartedAt, requireSession } from "@eleva/auth/server"
import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import { resolveGatewayUrl } from "@eleva/config/env"
import type { DecisionSignIn } from "@/components/decision-sign-in"

/**
 * What a review page tells its form about the reviewer's sign-in: how long
 * it is still good for a decision (the rule the API enforces), who is
 * reviewing, and where this review's draft is kept while they sign in.
 */
export function decisionDraftKey(
  subject: DecisionSignIn["subject"],
  reviewId: string
): string {
  return `eleva.decision-draft:${subject}:${reviewId}`
}

export async function decisionSignIn(
  subject: DecisionSignIn["subject"],
  reviewId: string
): Promise<DecisionSignIn> {
  const [session, startedAt] = await Promise.all([
    requireSession("applications:review"),
    getSessionStartedAt(),
  ])
  return {
    // Counted here, on the server's clock, the one the API will use.
    msLeft: startedAt
      ? Math.max(
          0,
          startedAt.getTime() + STAFF_DECISION_SIGN_IN_MAX_AGE_MS - Date.now()
        )
      : null,
    hours: STAFF_DECISION_SIGN_IN_MAX_AGE_MS / (60 * 60 * 1000),
    reviewer: { id: session.user.id, email: session.user.email },
    loginUrl: `${resolveGatewayUrl()}${LOGIN_PATH}`,
    draftKey: decisionDraftKey(subject, reviewId),
    subject,
  }
}
