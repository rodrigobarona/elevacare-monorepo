/**
 * Member cancellation policies an expert picks per service (D-06, working
 * pre-launch 2026-09-26). Finance and legal re-sign before production.
 * `resolveCancellationRefund` in `@eleva/scheduling` is the only place a
 * refund percentage is computed; this module is the SSOT for the tiers.
 */

export const CANCELLATION_POLICY_VALUES = [
  "flexible",
  "moderate",
  "strict",
] as const

export type CancellationPolicy = (typeof CANCELLATION_POLICY_VALUES)[number]

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = "flexible"

/**
 * Bump when a tier table below changes. Bookings store the version they
 * were sold under so a later edit never changes an existing booking.
 */
export const CANCELLATION_POLICY_VERSION = 1

export type CancellationTier = {
  /** Applies while at least this many hours remain before the session. */
  minHoursBefore: number
  refundPercent: number
}

/** Ordered from the earliest cancellation to the latest; the last tier has minHoursBefore 0. */
export const CANCELLATION_POLICY_TIERS: Record<
  CancellationPolicy,
  readonly CancellationTier[]
> = {
  flexible: [
    { minHoursBefore: 24, refundPercent: 100 },
    { minHoursBefore: 0, refundPercent: 0 },
  ],
  moderate: [
    { minHoursBefore: 48, refundPercent: 100 },
    { minHoursBefore: 24, refundPercent: 50 },
    { minHoursBefore: 0, refundPercent: 0 },
  ],
  strict: [
    { minHoursBefore: 7 * 24, refundPercent: 100 },
    { minHoursBefore: 48, refundPercent: 50 },
    { minHoursBefore: 0, refundPercent: 0 },
  ],
}

/** Every policy refunds in full within this many hours of booking... */
export const CANCELLATION_GRACE_HOURS = 24
/** ...as long as the session is still at least this many hours away. */
export const CANCELLATION_GRACE_MIN_LEAD_HOURS = 48

export type CancellationPolicyLocale = "en" | "pt" | "es"

const POLICY_COPY: Record<
  CancellationPolicyLocale,
  {
    names: Record<CancellationPolicy, string>
    hours: (n: number) => string
    days: (n: number) => string
    full: (window: string) => string
    partial: (percent: number, from: string, to: string) => string
    none: (window: string) => string
    grace: (graceWindow: string, lead: string) => string
    fullUntil: (date: string) => string
    partialUntil: (percent: number, date: string) => string
    noneAfter: (date: string) => string
    noRefund: string
  }
> = {
  en: {
    names: { flexible: "Flexible", moderate: "Moderate", strict: "Strict" },
    hours: (n) => `${n} hours`,
    days: (n) => `${n} days`,
    full: (w) => `Full refund if you cancel at least ${w} before the session.`,
    partial: (p, from, to) =>
      `${p}% refund if you cancel between ${from} and ${to} before.`,
    none: (w) => `No refund if you cancel less than ${w} before.`,
    grace: (g, lead) =>
      `Free cancellation within ${g} of booking, if the session is at least ${lead} away.`,
    fullUntil: (d) => `Full refund if you cancel before ${d}.`,
    partialUntil: (p, d) => `${p}% refund if you cancel before ${d}.`,
    noneAfter: (d) => `No refund if you cancel after ${d}.`,
    noRefund: "This session can no longer be refunded if you cancel.",
  },
  pt: {
    names: { flexible: "Flexível", moderate: "Moderada", strict: "Rigorosa" },
    hours: (n) => `${n} horas`,
    days: (n) => `${n} dias`,
    full: (w) =>
      `Reembolso total se cancelar com pelo menos ${w} de antecedência.`,
    partial: (p, from, to) =>
      `Reembolso de ${p}% se cancelar entre ${from} e ${to} antes.`,
    none: (w) => `Sem reembolso se cancelar com menos de ${w} de antecedência.`,
    grace: (g, lead) =>
      `Cancelamento gratuito nas ${g} após a marcação, se a sessão for daqui a pelo menos ${lead}.`,
    fullUntil: (d) => `Reembolso total se cancelar antes de ${d}.`,
    partialUntil: (p, d) => `Reembolso de ${p}% se cancelar antes de ${d}.`,
    noneAfter: (d) => `Sem reembolso se cancelar depois de ${d}.`,
    noRefund: "Esta sessão já não é reembolsável se cancelar.",
  },
  es: {
    names: { flexible: "Flexible", moderate: "Moderada", strict: "Estricta" },
    hours: (n) => `${n} horas`,
    days: (n) => `${n} días`,
    full: (w) =>
      `Reembolso completo si cancelas con al menos ${w} de antelación.`,
    partial: (p, from, to) =>
      `Reembolso del ${p}% si cancelas entre ${from} y ${to} antes.`,
    none: (w) => `Sin reembolso si cancelas con menos de ${w} de antelación.`,
    grace: (g, lead) =>
      `Cancelación gratuita en las ${g} siguientes a la reserva, si la sesión es dentro de al menos ${lead}.`,
    fullUntil: (d) => `Reembolso completo si cancelas antes del ${d}.`,
    partialUntil: (p, d) => `Reembolso del ${p}% si cancelas antes del ${d}.`,
    noneAfter: (d) => `Sin reembolso si cancelas después del ${d}.`,
    noRefund: "Esta sesión ya no es reembolsable si cancelas.",
  },
}

function formatWindow(
  hours: number,
  copy: (typeof POLICY_COPY)[CancellationPolicyLocale]
): string {
  return hours >= 72 && hours % 24 === 0
    ? copy.days(hours / 24)
    : copy.hours(hours)
}

/** Localized policy name plus one line per tier and the grace period. */
export function describeCancellationPolicy(
  policy: CancellationPolicy,
  locale: CancellationPolicyLocale
): { name: string; lines: string[] } {
  const copy = POLICY_COPY[locale]
  const tiers = CANCELLATION_POLICY_TIERS[policy]
  const lines: string[] = []
  tiers.forEach((tier, i) => {
    const earlier = tiers[i - 1]
    if (tier.refundPercent === 100) {
      lines.push(copy.full(formatWindow(tier.minHoursBefore, copy)))
    } else if (tier.refundPercent === 0) {
      lines.push(copy.none(formatWindow(earlier!.minHoursBefore, copy)))
    } else {
      lines.push(
        copy.partial(
          tier.refundPercent,
          formatWindow(earlier!.minHoursBefore, copy),
          formatWindow(tier.minHoursBefore, copy)
        )
      )
    }
  })
  lines.push(
    copy.grace(
      formatWindow(CANCELLATION_GRACE_HOURS, copy),
      formatWindow(CANCELLATION_GRACE_MIN_LEAD_HOURS, copy)
    )
  )
  return { name: copy.names[policy], lines }
}

export function isCancellationPolicy(
  value: unknown
): value is CancellationPolicy {
  return (
    typeof value === "string" &&
    (CANCELLATION_POLICY_VALUES as readonly string[]).includes(value)
  )
}

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
  return end >= bookedAt.getTime() ? new Date(end) : null
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

export type CancellationDeadline = {
  refundPercent: number
  /** Last instant a cancel still gets `refundPercent`. */
  until: Date
}

/** Refund steps still ahead for a booking made at `bookedAt`, earliest first. */
export function cancellationDeadlines(input: {
  policy: CancellationPolicy
  bookedAt: Date
  startsAt: Date
}): CancellationDeadline[] {
  const { fullRefundUntil } = resolveCancellationRefund({
    ...input,
    now: input.bookedAt,
  })
  const deadlines: CancellationDeadline[] = []
  if (fullRefundUntil) {
    deadlines.push({ refundPercent: 100, until: fullRefundUntil })
  }
  for (const tier of tiersFor(input.policy)) {
    if (tier.refundPercent === 0 || tier.refundPercent === 100) continue
    const until = tierDeadline(input.startsAt, tier)
    const floor = fullRefundUntil ?? input.bookedAt
    if (until.getTime() > floor.getTime()) {
      deadlines.push({ refundPercent: tier.refundPercent, until })
    }
  }
  return deadlines
}

/** One localized line per deadline plus the no-refund cutoff. */
export function describeCancellationDeadlines(
  deadlines: readonly CancellationDeadline[],
  locale: CancellationPolicyLocale,
  formatDate: (date: Date) => string
): string[] {
  const copy = POLICY_COPY[locale]
  const last = deadlines[deadlines.length - 1]
  if (!last) return [copy.noRefund]
  return [
    ...deadlines.map((d) =>
      d.refundPercent === 100
        ? copy.fullUntil(formatDate(d.until))
        : copy.partialUntil(d.refundPercent, formatDate(d.until))
    ),
    copy.noneAfter(formatDate(last.until)),
  ]
}
