import type { CancellationQuote } from "@eleva/api-client"
import type {
  MemberBookingPolicyError,
  MemberCancellationQuote,
} from "@eleva/scheduling"

export const MEMBER_BOOKING_POLICY_STATUS: Record<
  MemberBookingPolicyError["code"],
  number
> = {
  not_found: 404,
  POLICY_TOO_LATE: 409,
  INVALID_STATUS: 409,
  SLOT_TAKEN: 409,
}

export function serializeCancellationQuote(
  quote: MemberCancellationQuote
): CancellationQuote {
  return {
    policy: quote.policy,
    refundPercent: quote.refundPercent,
    refundCents: quote.refundCents,
    currency: quote.currency,
    reason: quote.reason,
    fullRefundUntil: quote.fullRefundUntil?.toISOString() ?? null,
    nextChangeAt: quote.nextChangeAt?.toISOString() ?? null,
  }
}
