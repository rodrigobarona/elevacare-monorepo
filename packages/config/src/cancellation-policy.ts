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
