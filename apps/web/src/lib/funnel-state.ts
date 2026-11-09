export const FUNNEL_STEPS = ["meet", "when", "details", "pay", "done"] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

export type FunnelStartInput = {
  pinnedModeId?: string | null
  skipToWhen: boolean
  skipToDetails?: boolean
}

export function initialFunnelStep(input: FunnelStartInput): FunnelStep {
  if (input.skipToDetails) return "details"
  if (input.pinnedModeId || input.skipToWhen) return "when"
  return "meet"
}

export function previousFunnelStep(
  step: FunnelStep,
  input: FunnelStartInput
): FunnelStep | null {
  switch (step) {
    case "meet":
      return null
    case "when":
      return input.pinnedModeId || input.skipToWhen ? null : "meet"
    case "details":
      return "when"
    case "pay":
      return "details"
    case "done":
      return null
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}

export type FunnelLocale = "en" | "pt" | "es"

export function initialFunnelLanguage(
  locale: FunnelLocale,
  offeredLanguageIds: readonly string[]
): FunnelLocale {
  const offered = new Set(
    offeredLanguageIds.map((value) => {
      const normalized = value.toLowerCase()
      return normalized.split("-")[0] ?? normalized
    })
  )
  if (offered.has(locale) || offered.size === 0) return locale
  const first = [...offered][0]
  if (first === "en" || first === "pt" || first === "es") return first
  return locale
}

export function mapReserveError(code: string | undefined): string {
  if (!code) return "generic"
  switch (code) {
    case "SLOT_UNAVAILABLE":
    case "SLOT_TAKEN":
      return "slotTaken"
    case "MODE_NOT_AVAILABLE_IN_COUNTRY":
      return "modeCountry"
    case "MODE_LANGUAGE_MISMATCH":
      return "modeLanguage"
    case "PHONE_REQUIRED":
      return "phoneRequired"
    case "GUEST_REQUIRED":
      return "guestRequired"
    case "CONSENT_VERSION_OUTDATED":
      return "consentOutdated"
    case "POLICY_CHANGED":
      return "policyChanged"
    default:
      return "generic"
  }
}

export function mapConfirmError(code: string | undefined): string {
  if (!code) return "confirmFailed"
  switch (code) {
    case "PAYMENT_MISMATCH":
      return "confirmMismatch"
    case "PAYMENT_FAILED":
      return "paymentFailed"
    case "unavailable":
      return "confirmFailed"
    default:
      return "confirmFailed"
  }
}

type WindowSlot = { start: string }

export type SlotWindowState<T extends WindowSlot> = {
  /** The cached "Next available" time. */
  earliest: T | null
  /** Still looking for the first open time. */
  seeking: boolean
  /** The member's chosen time. */
  selected: T | null
}

/**
 * Reconcile the funnel with a fresh load of open times for one window of
 * civil days `[fromKey, windowEnd)`. `dayOf` maps a time to its civil day in
 * the member's zone. Anything the window covers but the API no longer lists
 * is stale: a stale "Next available" is replaced by the window's first time
 * (or the search resumes), and a stale choice is cleared and reported.
 */
export function reconcileSlotWindow<T extends WindowSlot>(input: {
  state: SlotWindowState<T>
  /** Open times returned by the API for this load. */
  slots: readonly T[]
  fromKey: string
  windowEnd: string
  dayOf: (slot: T) => string
}): SlotWindowState<T> & { selectionGone: boolean } {
  const { state, slots, fromKey, windowEnd, dayOf } = input
  const covers = (slot: T) => {
    const day = dayOf(slot)
    return day >= fromKey && day < windowEnd
  }
  const listed = (slot: T) => slots.some((item) => item.start === slot.start)
  const first =
    [...slots]
      .filter((slot) => dayOf(slot) >= fromKey)
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null

  let { earliest, seeking } = state
  const earliestGone = earliest != null && covers(earliest) && !listed(earliest)
  if (earliestGone) {
    earliest = null
    seeking = true
  }
  if (seeking && first) {
    earliest = first
    seeking = false
  }

  const selectionGone =
    state.selected != null && covers(state.selected) && !listed(state.selected)
  return {
    earliest,
    seeking,
    selected: selectionGone ? null : state.selected,
    selectionGone,
  }
}
