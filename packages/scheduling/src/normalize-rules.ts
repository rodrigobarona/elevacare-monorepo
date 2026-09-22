export type AvailabilityRuleInput = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type NormalizeRulesError =
  | "INVALID_DAY"
  | "INVALID_TIME"
  | "START_AFTER_END"
  | "CROSS_MIDNIGHT"

export type NormalizeRulesResult =
  | { ok: true; rules: AvailabilityRuleInput[] }
  | { ok: false; error: NormalizeRulesError; message: string }

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Normalize weekly availability rules: reject cross-midnight and invalid
 * ranges, then merge overlapping / contiguous ranges on the same weekday.
 */
export function normalizeAvailabilityRules(
  rules: readonly AvailabilityRuleInput[]
): NormalizeRulesResult {
  for (const rule of rules) {
    if (
      !Number.isInteger(rule.dayOfWeek) ||
      rule.dayOfWeek < 0 ||
      rule.dayOfWeek > 6
    ) {
      return {
        ok: false,
        error: "INVALID_DAY",
        message:
          "dayOfWeek must be an integer from 0 (Sunday) to 6 (Saturday).",
      }
    }
    if (
      !TIME_PATTERN.test(rule.startTime) ||
      !TIME_PATTERN.test(rule.endTime)
    ) {
      return {
        ok: false,
        error: "INVALID_TIME",
        message: "startTime and endTime must be HH:MM in 24-hour format.",
      }
    }
    if (rule.startTime === rule.endTime) {
      return {
        ok: false,
        error: "START_AFTER_END",
        message: "startTime must be before endTime (same-day ranges only).",
      }
    }
    if (rule.startTime > rule.endTime) {
      return {
        ok: false,
        error: "CROSS_MIDNIGHT",
        message:
          "Availability ranges cannot cross midnight. Split into two same-day ranges.",
      }
    }
  }

  const byDay = new Map<number, AvailabilityRuleInput[]>()
  for (const rule of rules) {
    const list = byDay.get(rule.dayOfWeek) ?? []
    list.push({ ...rule })
    byDay.set(rule.dayOfWeek, list)
  }

  const merged: AvailabilityRuleInput[] = []
  const days = [...byDay.keys()].sort((a, b) => a - b)
  for (const day of days) {
    const dayRules = [...(byDay.get(day) ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
    let current: AvailabilityRuleInput | null = null
    for (const rule of dayRules) {
      if (!current) {
        current = { ...rule }
        continue
      }
      if (rule.startTime <= current.endTime) {
        if (rule.endTime > current.endTime) {
          current.endTime = rule.endTime
        }
        continue
      }
      merged.push(current)
      current = { ...rule }
    }
    if (current) merged.push(current)
  }

  return { ok: true, rules: merged }
}
