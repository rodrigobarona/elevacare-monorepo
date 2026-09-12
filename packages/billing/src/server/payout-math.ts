/**
 * Pure payout / refund math (Phase 06.2). No Stripe, no DB.
 */

export const DEFAULT_PAYOUT_APPROVAL_THRESHOLD_CENTS = 50_000
/** Dual-control threshold from D-06. Enforcement is Phase 12 admin. */
export const ADMIN_DUAL_CONTROL_REFUND_CENTS = 20_000
export const MEMBER_FULL_REFUND_WINDOW_HOURS = 24
export const LISBON_TZ = "Europe/Lisbon"

export type PayoutStatus =
  | "pending"
  | "scheduled"
  | "approval_required"
  | "transferred"
  | "paid_out"
  | "failed"
  | "held"
  | "reversal_pending"
  | "reversed"

export type HoldReason = "dispute" | "manual"

export type RefundPolicyOutcome =
  | "full"
  | "requires_review"
  | "keep"
  | "partial"

export type RefundPolicyInput = {
  initiator: "member" | "expert" | "staff"
  hoursUntilStart: number | null
  attendance?: "present" | "member_no_show" | "expert_no_show" | null
}

export function payoutApprovalThresholdCents(envValue?: string): number {
  if (!envValue) return DEFAULT_PAYOUT_APPROVAL_THRESHOLD_CENTS
  const trimmed = envValue.trim()
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_PAYOUT_APPROVAL_THRESHOLD_CENTS
  }
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return DEFAULT_PAYOUT_APPROVAL_THRESHOLD_CENTS
  }
  return parsed
}

export function needsPayoutApproval(input: {
  amountCents: number
  isFirstPayoutForAccount: boolean
  thresholdCents?: number
}): boolean {
  const threshold = input.thresholdCents ?? payoutApprovalThresholdCents()
  return input.isFirstPayoutForAccount || input.amountCents >= threshold
}

export function evaluateRefundPolicy(
  input: RefundPolicyInput
): RefundPolicyOutcome {
  if (
    input.attendance === "member_no_show" ||
    input.attendance === "expert_no_show"
  ) {
    return "requires_review"
  }
  if (input.initiator === "expert") return "full"
  if (input.initiator === "staff") return "requires_review"
  if (input.hoursUntilStart === null) return "requires_review"
  if (input.hoursUntilStart >= MEMBER_FULL_REFUND_WINDOW_HOURS) return "full"
  return "requires_review"
}

export function cumulativeReversalCents(input: {
  refundedToDate: number
  grossCents: number
  transferredCents: number
  reversedToDate: number
}): number {
  if (input.grossCents <= 0 || input.transferredCents <= 0) return 0
  const target = Math.round(
    (input.refundedToDate / input.grossCents) * input.transferredCents
  )
  const remaining = Math.max(0, input.transferredCents - input.reversedToDate)
  const share = target - input.reversedToDate
  if (share <= 0) return 0
  return Math.min(share, remaining)
}

type LisbonParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function lisbonParts(date: Date): LisbonParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const bag = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value])
  )
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  }
}

function lisbonLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  for (let i = 0; i < 4; i += 1) {
    const parts = lisbonParts(utc)
    const asLisbon = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )
    const wanted = Date.UTC(year, month - 1, day, hour, minute)
    utc = new Date(utc.getTime() + (wanted - asLisbon))
  }
  return utc
}

function addLisbonCalendarDays(parts: LisbonParts, days: number): LisbonParts {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12)
  return lisbonParts(new Date(utcGuess))
}

export function snapToNext0400Lisbon(date: Date): Date {
  const parts = lisbonParts(date)
  const sameDay = lisbonLocalToUtc(parts.year, parts.month, parts.day, 4, 0)
  if (date.getTime() <= sameDay.getTime()) return sameDay
  const next = addLisbonCalendarDays(parts, 1)
  return lisbonLocalToUtc(next.year, next.month, next.day, 4, 0)
}

export function computeEligibleAt(paidAt: Date, sessionEnd: Date): Date {
  const paidPlus7 = new Date(paidAt.getTime() + 7 * 24 * 60 * 60 * 1000)
  const sessionPlus24 = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000)
  const raw =
    paidPlus7.getTime() >= sessionPlus24.getTime() ? paidPlus7 : sessionPlus24
  return snapToNext0400Lisbon(raw)
}

export function applyHoldSet(input: {
  holdReasons: readonly string[]
  status: PayoutStatus
  heldFromStatus: PayoutStatus | null
  reason: HoldReason
}): {
  holdReasons: HoldReason[]
  status: PayoutStatus
  heldFromStatus: PayoutStatus | null
} {
  const next = new Set(input.holdReasons.filter(isHoldReason))
  const first = next.size === 0
  next.add(input.reason)
  const captured: PayoutStatus =
    input.status === "held" ? (input.heldFromStatus ?? "pending") : input.status
  return {
    holdReasons: [...next],
    status: "held",
    heldFromStatus: first ? captured : input.heldFromStatus,
  }
}

export function nextPayoutStatusAfterRefund(input: {
  previousStatus: PayoutStatus
  amountCents: number
  reversedCentsAfter: number
  transferExists: boolean
  reversalOk: boolean
}): PayoutStatus {
  if (input.transferExists && !input.reversalOk) return "reversal_pending"
  if (input.reversedCentsAfter >= input.amountCents) return "reversed"
  return input.previousStatus
}

export function clearHoldSet(input: {
  holdReasons: readonly string[]
  heldFromStatus: PayoutStatus | null
  reason: HoldReason
}): {
  holdReasons: HoldReason[]
  status: PayoutStatus | null
  heldFromStatus: PayoutStatus | null
  remaining: HoldReason[]
} {
  const next = input.holdReasons
    .filter(isHoldReason)
    .filter((r) => r !== input.reason)
  if (next.length === 0) {
    return {
      holdReasons: [],
      status: input.heldFromStatus,
      heldFromStatus: null,
      remaining: [],
    }
  }
  return {
    holdReasons: next,
    status: "held",
    heldFromStatus: input.heldFromStatus,
    remaining: next,
  }
}

function isHoldReason(value: string): value is HoldReason {
  return value === "dispute" || value === "manual"
}
