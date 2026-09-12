/**
 * Settlement defaults for D-03 / D-04 (working pre-launch, 2026-09-12).
 * Finance re-signs before go-live. `computeSettlement` in `@eleva/billing`
 * is the only place money is split; this module is the config SSOT for
 * fee bearer per booking kind and the advertised commission bps.
 */

export const SETTLEMENT_FEE_BEARER_VALUES = [
  "platform",
  "expert",
  "clinic",
] as const

/** SSOT union from payments-payouts-spec.md. Marketplace default is platform. */
export type SettlementFeeBearer = (typeof SETTLEMENT_FEE_BEARER_VALUES)[number]

export const SETTLEMENT_FEE_BEARER = {
  marketplace: "platform",
  clinic: "clinic",
} as const satisfies Record<string, SettlementFeeBearer>

export type SettlementBookingKind = keyof typeof SETTLEMENT_FEE_BEARER

export const DEFAULT_COMMISSION_BPS = 1500
export const TOP_EXPERT_COMMISSION_BPS = 800
export const CLINIC_COMMISSION_BPS = 0
export const PT_VAT_RATE_BPS = 2300
