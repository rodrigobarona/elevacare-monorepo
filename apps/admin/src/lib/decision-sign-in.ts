import { LOGIN_PATH } from "@eleva/auth"
import { getSessionStartedAt, requireSession } from "@eleva/auth/server"
import { STAFF_DECISION_SIGN_IN_MAX_AGE_MS } from "@eleva/config/clinic-verification"
import { resolveGatewayUrl } from "@eleva/config/env"
import type { DecisionSignIn } from "@/components/decision-sign-in"
import { decisionDraftKey } from "@/lib/decision-draft-key"

/**
 * What a review page tells its form about the reviewer's sign-in: how long
 * it is still good for a decision (the rule the API enforces), who is
 * reviewing, and where this review's draft is kept while they sign in.
 */
export async function decisionSignIn(
  subject: DecisionSignIn["subject"],
  reviewId: string
): Promise<DecisionSignIn> {
  const [session, startedAt] = await Promise.all([
    requireSession("applications:review"),
    getSessionStartedAt(),
  ])
  return {
    // Counted here, on the server's clock, the one the API will use. Zero
    // or less means it was already too old.
    msLeft: startedAt
      ? startedAt.getTime() + STAFF_DECISION_SIGN_IN_MAX_AGE_MS - Date.now()
      : null,
    startedAt: startedAt ? startedAt.toISOString() : null,
    hours: STAFF_DECISION_SIGN_IN_MAX_AGE_MS / (60 * 60 * 1000),
    reviewer: {
      id: session.user.id,
      email: session.user.email,
      orgId: session.orgId,
    },
    loginUrl: `${resolveGatewayUrl()}${LOGIN_PATH}`,
    draftKey: decisionDraftKey(subject, reviewId),
    subject,
  }
}
