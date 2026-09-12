import {
  CLINIC_COMMISSION_BPS,
  DEFAULT_COMMISSION_BPS,
  SETTLEMENT_FEE_BEARER,
  TOP_EXPERT_COMMISSION_BPS,
  type SettlementFeeBearer,
} from "@eleva/config"
import {
  ENTITLEMENT_KEYS,
  getCommissionRate as flagsGetCommissionRate,
  hasAdvancedCRM,
  hasAnyEntitlement,
  hasEntitlement,
  hasPriorityRanking,
} from "@eleva/flags"

/**
 * Commission + entitlement helpers for the billing domain.
 *
 * Phase 1 of W1 wires `@eleva/flags` into a stable boundary inside
 * `@eleva/billing/server`. Booking, marketplace, and admin code calls
 * these helpers instead of reading `session.entitlements` directly,
 * so the Stripe Entitlements -> session -> app-behavior chain has
 * one canonical entry point.
 *
 * The helpers are pure functions on the session shape and don't touch
 * Stripe at runtime (entitlements arrive via the Better Auth session).
 * They are SSR-safe and edge-runtime safe.
 *
 * Source-of-truth wiring:
 *   - Stripe Entitlement features seeded by infra/stripe/seed-entitlements
 *   - Customer subscription -> session entitlements claim
 *   - Session assembled in @eleva/auth loadElevaSession
 *   - Booking domain calls computeCommissionRate(session) here
 *
 * See ADR-016 for the full chain.
 */

/**
 * Minimal session shape consumed by the commission helpers. Avoids
 * importing the full ElevaSession type so this module can be used by
 * code paths that don't have @eleva/auth as a peer.
 */
export interface BillingSession {
  entitlements?: readonly string[]
}

/**
 * Computes the platform commission rate that should apply to a
 * booking's gross amount. Solo expert defaults to 15%; Top Expert
 * subscribers get 8%. Clinic tiers pay nothing per booking (their
 * SaaS subscription covers platform costs).
 *
 * Returns a rate in [0, 1] (e.g. 0.08 = 8%).
 */
export function computeCommissionRate(session: BillingSession): number {
  return flagsGetCommissionRate(session)
}

/**
 * Whether the session qualifies for priority search ranking.
 * Top Expert + Clinic Growth get the boost.
 */
export function isPriorityRanked(session: BillingSession): boolean {
  return hasPriorityRanking(session)
}

/**
 * Whether the session has access to the advanced CRM features
 * (member analytics, custom branding, etc.).
 */
export function hasCRMAccess(session: BillingSession): boolean {
  return hasAdvancedCRM(session)
}

/**
 * Whether the session has the Top Expert entitlement (8% commission,
 * priority ranking, advanced CRM).
 */
export function isTopExpert(session: BillingSession): boolean {
  return hasEntitlement(session, ENTITLEMENT_KEYS.EXPERT_TOP)
}

/**
 * Whether the session has any clinic SaaS entitlement (Starter or Growth).
 */
export function isClinicSaaS(session: BillingSession): boolean {
  return hasAnyEntitlement(session, [
    ENTITLEMENT_KEYS.CLINIC_STARTER,
    ENTITLEMENT_KEYS.CLINIC_GROWTH,
  ])
}

export { ENTITLEMENT_KEYS, type EntitlementKey } from "@eleva/flags"

export type VatTreatment = "pt_b2b" | "eu_reverse_charge" | "eu_b2c" | "non_eu"

export type BuyerKind = "marketplace" | "clinic"

export type CreditNoteAllocation = {
  platformFeeGross: number
  platformFeeNet: number
  vatOnPlatformFee: number
  paymentProcessingFee: number
  expertTransfer: number
}

export type SettlementAmounts = {
  bookingGross: number
  platformFeeGross: number
  platformFeeNet: number
  vatOnPlatformFee: number
  paymentProcessingFee: number
  expertTransfer: number
}

export type SettlementResult = SettlementAmounts & {
  rounding: "half-up-cents-on-fee"
  currency: "EUR"
}

export type ComputeApplicationFeeInput = {
  amountCents: number
  entitlements: readonly string[]
  commissionOverrideBps?: number | null
  commissionOverrideExpiresAt?: Date | null
  buyerKind: BuyerKind
  now?: Date
}

export type ComputeApplicationFeeResult = {
  commissionBps: number
  feeBearer: SettlementFeeBearer
}

/**
 * Half-up rounding to integer cents, applied once on the fee.
 * `Math.round` is half-up for non-negative values.
 */
export function roundHalfUpCents(value: number): number {
  return Math.round(value)
}

function marketplaceCommissionBps(session: BillingSession): number {
  if (isTopExpert(session)) return TOP_EXPERT_COMMISSION_BPS
  return DEFAULT_COMMISSION_BPS
}

function overrideIsActive(
  bps: number | null | undefined,
  expiresAt: Date | null | undefined,
  now: Date
): bps is number {
  if (bps == null) return false
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return false
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("commissionOverrideBps must be an integer in 0..10000")
  }
  return true
}

/**
 * Advertised commission in basis points plus the D-04 fee bearer.
 * Clinic-attributed bookings are always 0 bps. Grandfathered overrides
 * apply only to marketplace bookings and must not be expired.
 */
export function computeApplicationFee(
  input: ComputeApplicationFeeInput
): ComputeApplicationFeeResult {
  if (input.amountCents < 0) {
    throw new Error("amountCents must be >= 0")
  }
  if (input.buyerKind === "clinic") {
    return {
      commissionBps: CLINIC_COMMISSION_BPS,
      feeBearer: SETTLEMENT_FEE_BEARER.clinic,
    }
  }

  const now = input.now ?? new Date()
  if (
    overrideIsActive(
      input.commissionOverrideBps,
      input.commissionOverrideExpiresAt,
      now
    )
  ) {
    return {
      commissionBps: input.commissionOverrideBps,
      feeBearer: SETTLEMENT_FEE_BEARER.marketplace,
    }
  }

  const session: BillingSession = { entitlements: input.entitlements }
  return {
    commissionBps: marketplaceCommissionBps(session),
    feeBearer: SETTLEMENT_FEE_BEARER.marketplace,
  }
}

function vatSplit(
  platformFeeGross: number,
  vatRateBps: number,
  vatTreatment: VatTreatment
): { platformFeeNet: number; vatOnPlatformFee: number } {
  switch (vatTreatment) {
    case "eu_reverse_charge":
    case "non_eu":
      return { platformFeeNet: platformFeeGross, vatOnPlatformFee: 0 }
    case "pt_b2b":
    case "eu_b2c": {
      const divisor = 1 + vatRateBps / 10_000
      const platformFeeNet = roundHalfUpCents(platformFeeGross / divisor)
      return {
        platformFeeNet,
        vatOnPlatformFee: platformFeeGross - platformFeeNet,
      }
    }
    default: {
      const _exhaustive: never = vatTreatment
      return _exhaustive
    }
  }
}

function expertTransferCents(input: {
  grossCents: number
  platformFeeGross: number
  processingFeeCents: number
  feeBearer: SettlementFeeBearer
}): number {
  switch (input.feeBearer) {
    case "platform":
      return input.grossCents - input.platformFeeGross
    case "clinic":
      return input.grossCents - input.processingFeeCents
    case "expert":
      return (
        input.grossCents - input.platformFeeGross - input.processingFeeCents
      )
    default: {
      const _exhaustive: never = input.feeBearer
      return _exhaustive
    }
  }
}

const ZERO_ALLOCATION: CreditNoteAllocation = {
  platformFeeGross: 0,
  platformFeeNet: 0,
  vatOnPlatformFee: 0,
  paymentProcessingFee: 0,
  expertTransfer: 0,
}

function subtractAllocations(
  target: CreditNoteAllocation,
  previous: CreditNoteAllocation
): CreditNoteAllocation {
  return {
    platformFeeGross: target.platformFeeGross - previous.platformFeeGross,
    platformFeeNet: target.platformFeeNet - previous.platformFeeNet,
    vatOnPlatformFee: target.vatOnPlatformFee - previous.vatOnPlatformFee,
    paymentProcessingFee:
      target.paymentProcessingFee - previous.paymentProcessingFee,
    expertTransfer: target.expertTransfer - previous.expertTransfer,
  }
}

function allocationAtRefunded(
  settlement: SettlementAmounts,
  refundedCents: number
): CreditNoteAllocation {
  if (settlement.bookingGross <= 0 || refundedCents <= 0) {
    return ZERO_ALLOCATION
  }
  const capped = Math.min(refundedCents, settlement.bookingGross)
  if (capped === settlement.bookingGross) {
    return {
      platformFeeGross: settlement.platformFeeGross,
      platformFeeNet: settlement.platformFeeNet,
      vatOnPlatformFee: settlement.vatOnPlatformFee,
      paymentProcessingFee: settlement.paymentProcessingFee,
      expertTransfer: settlement.expertTransfer,
    }
  }
  const ratio = capped / settlement.bookingGross
  const platformFeeGross = roundHalfUpCents(settlement.platformFeeGross * ratio)
  const platformFeeNet =
    settlement.platformFeeGross === 0
      ? 0
      : roundHalfUpCents(settlement.platformFeeNet * ratio)
  return {
    platformFeeGross,
    platformFeeNet,
    vatOnPlatformFee: platformFeeGross - platformFeeNet,
    paymentProcessingFee: roundHalfUpCents(
      settlement.paymentProcessingFee * ratio
    ),
    expertTransfer: roundHalfUpCents(settlement.expertTransfer * ratio),
  }
}

function allocateProportionally(
  settlement: SettlementAmounts,
  refundCents: number,
  alreadyRefundedCents = 0
): CreditNoteAllocation {
  const previous = Math.min(
    Math.max(alreadyRefundedCents, 0),
    settlement.bookingGross
  )
  const target = Math.min(
    previous + Math.max(refundCents, 0),
    settlement.bookingGross
  )
  return subtractAllocations(
    allocationAtRefunded(settlement, target),
    allocationAtRefunded(settlement, previous)
  )
}

function assertNonNegativeInt(name: string, value: number, max?: number): void {
  if (!Number.isInteger(value) || value < 0 || Number.isNaN(value)) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  if (max != null && value > max) {
    throw new Error(`${name} must be <= ${max}`)
  }
}

/**
 * Single money-split function (D-03 / D-04). No other module may add,
 * subtract, or round money.
 */
export function computeSettlement(input: {
  grossCents: number
  commissionBps: number
  vatRateBps: number
  vatTreatment: VatTreatment
  processingFeeCents: number
  feeBearer: SettlementFeeBearer
}): SettlementResult {
  assertNonNegativeInt("grossCents", input.grossCents)
  assertNonNegativeInt("commissionBps", input.commissionBps, 10_000)
  assertNonNegativeInt("vatRateBps", input.vatRateBps, 10_000)
  assertNonNegativeInt("processingFeeCents", input.processingFeeCents)
  if (input.feeBearer === "clinic" && input.commissionBps !== 0) {
    throw new Error(
      "clinic fee bearer requires commissionBps 0 (D-04 invariant)"
    )
  }
  const platformFeeGross = roundHalfUpCents(
    (input.grossCents * input.commissionBps) / 10_000
  )
  const { platformFeeNet, vatOnPlatformFee } = vatSplit(
    platformFeeGross,
    input.vatRateBps,
    input.vatTreatment
  )
  const paymentProcessingFee = input.processingFeeCents
  const expertTransfer = expertTransferCents({
    grossCents: input.grossCents,
    platformFeeGross,
    processingFeeCents: input.processingFeeCents,
    feeBearer: input.feeBearer,
  })
  if (expertTransfer < 0) {
    throw new Error("expertTransfer must be >= 0")
  }

  const core = {
    bookingGross: input.grossCents,
    platformFeeGross,
    platformFeeNet,
    vatOnPlatformFee,
    paymentProcessingFee,
    expertTransfer,
  }

  return {
    ...core,
    rounding: "half-up-cents-on-fee",
    currency: "EUR",
  }
}

/**
 * D-06 experiment only. Not part of the production settlement contract.
 * Refund, dispute, and no-show flows must not call this until D-06 is signed.
 */
export function experimentalCreditNoteAllocation(
  settlement: SettlementAmounts,
  refundCents: number,
  alreadyRefundedCents = 0
): CreditNoteAllocation {
  return allocateProportionally(settlement, refundCents, alreadyRefundedCents)
}
