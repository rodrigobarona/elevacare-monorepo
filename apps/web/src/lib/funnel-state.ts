export const FUNNEL_STEPS = ["meet", "when", "details", "pay", "done"] as const

export type FunnelStep = (typeof FUNNEL_STEPS)[number]

export type FunnelStartInput = {
  pinnedModeId?: string | null
  skipToWhen: boolean
}

export function initialFunnelStep(input: FunnelStartInput): FunnelStep {
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
    default:
      return "generic"
  }
}
