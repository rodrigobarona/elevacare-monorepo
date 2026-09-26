import {
  CANCELLATION_GRACE_HOURS,
  CANCELLATION_GRACE_MIN_LEAD_HOURS,
  CANCELLATION_POLICY_TIERS,
  type CancellationPolicy,
  type CancellationTier,
} from "@eleva/config"

const HOUR_MS = 3_600_000

export type CancellationRefundReason = "grace_period" | "policy_tier"

export type CancellationRefundQuote = {
  policy: CancellationPolicy
  refundPercent: number
  reason: CancellationRefundReason
  /** Last instant a cancel still gets a full refund; null once that has passed. */
  fullRefundUntil: Date | null
  /** When the refund percentage next drops; null when it can no longer drop. */
  nextChangeAt: Date | null
}

function tiersFor(policy: CancellationPolicy): readonly CancellationTier[] {
  switch (policy) {
    case "flexible":
    case "moderate":
    case "strict":
      return CANCELLATION_POLICY_TIERS[policy]
    default: {
      const exhaustive: never = policy
      throw new Error(`Unknown cancellation policy: ${String(exhaustive)}`)
    }
  }
}

function tierAt(
  tiers: readonly CancellationTier[],
  hoursBefore: number
): CancellationTier {
  for (const tier of tiers) {
    if (hoursBefore >= tier.minHoursBefore) return tier
  }
  return tiers[tiers.length - 1]!
}

function tierDeadline(startsAt: Date, tier: CancellationTier): Date {
  return new Date(startsAt.getTime() - tier.minHoursBefore * HOUR_MS)
}

function graceEndsAt(bookedAt: Date, startsAt: Date): Date | null {
  const graceEnd = bookedAt.getTime() + CANCELLATION_GRACE_HOURS * HOUR_MS
  const leadEnd =
    startsAt.getTime() - CANCELLATION_GRACE_MIN_LEAD_HOURS * HOUR_MS
  const end = Math.min(graceEnd, leadEnd)
  return end > bookedAt.getTime() ? new Date(end) : null
}

/**
 * Refund a member gets for cancelling now under the policy their booking
 * was sold with. Times are absolute instants, so DST never shifts a tier.
 */
export type ResolveCancellationRefundInput = {
  policy: CancellationPolicy
  bookedAt: Date
  startsAt: Date
  now?: Date
}

export function resolveCancellationRefund(
  input: ResolveCancellationRefundInput
): CancellationRefundQuote {
  const now = input.now ?? new Date()
  const tiers = tiersFor(input.policy)
  const hoursBefore = (input.startsAt.getTime() - now.getTime()) / HOUR_MS
  const tier = tierAt(tiers, hoursBefore)
  const fullTier = tiers.find((t) => t.refundPercent === 100)
  const tierFullUntil = fullTier ? tierDeadline(input.startsAt, fullTier) : null
  const grace = graceEndsAt(input.bookedAt, input.startsAt)
  const fullUntilMs = Math.max(
    tierFullUntil?.getTime() ?? -Infinity,
    grace?.getTime() ?? -Infinity
  )
  const fullRefundUntil =
    fullUntilMs >= now.getTime() ? new Date(fullUntilMs) : null
  const inGrace = grace !== null && now.getTime() <= grace.getTime()

  if (inGrace && tier.refundPercent < 100) {
    return {
      policy: input.policy,
      refundPercent: 100,
      reason: "grace_period",
      fullRefundUntil,
      nextChangeAt: grace,
    }
  }

  const isLastTier = tiers.indexOf(tier) === tiers.length - 1
  return {
    policy: input.policy,
    refundPercent: tier.refundPercent,
    reason: "policy_tier",
    fullRefundUntil,
    nextChangeAt: isLastTier ? null : tierDeadline(input.startsAt, tier),
  }
}

/** Cents to refund for a percentage of what is still refundable. */
export function cancellationRefundCents(
  refundableCents: number,
  refundPercent: number
): number {
  if (refundableCents <= 0 || refundPercent <= 0) return 0
  if (refundPercent >= 100) return refundableCents
  return Math.round((refundableCents * refundPercent) / 100)
}
