import {
  assertOfferInvariants,
  OFFER_INVARIANT_MESSAGES,
  type OfferInvariantError,
  type OfferKind,
  type OfferMode,
  type CountryScopeType,
} from "./offer-invariants"

export type PublishModeInput = {
  modeId: string
  mode: OfferMode
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  locationCountry: string | null
  active: boolean
}

export type PublishEventTypeInput = {
  kind: OfferKind
  hasPublicHandle: boolean
  worldwideRemote: boolean
  serviceCountries: string[]
  profileLanguages: string[]
  modes: PublishModeInput[]
}

export type PublishViolation = {
  modeId: string | null
  code: OfferInvariantError | "NO_ACTIVE_MODE" | "MISSING_PUBLIC_HANDLE"
  message: string
}

export type PublishEventTypeResult =
  | { ok: true }
  | { ok: false; violations: PublishViolation[] }

/**
 * Validate that an event type may be published: public handle present,
 * at least one active delivery mode, and every active mode passes
 * offer-invariants against the practice profile.
 */
export function publishEventType(
  input: PublishEventTypeInput
): PublishEventTypeResult {
  const violations: PublishViolation[] = []

  if (!input.hasPublicHandle) {
    violations.push({
      modeId: null,
      code: "MISSING_PUBLIC_HANDLE",
      message:
        "Add a public handle before publishing so members can find your offer.",
    })
  }

  const activeModes = input.modes.filter((mode) => mode.active)
  if (activeModes.length === 0) {
    violations.push({
      modeId: null,
      code: "NO_ACTIVE_MODE",
      message: "Add at least one active delivery mode before publishing.",
    })
  }

  for (const mode of activeModes) {
    const code = assertOfferInvariants({
      kind: input.kind,
      mode: mode.mode,
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      locationCountry: mode.locationCountry,
      worldwideRemote: input.worldwideRemote,
      serviceCountries: input.serviceCountries,
      profileLanguages: input.profileLanguages,
    })
    if (!code) continue
    violations.push({
      modeId: mode.modeId,
      code,
      message: OFFER_INVARIANT_MESSAGES[code],
    })
  }

  if (violations.length > 0) return { ok: false, violations }
  return { ok: true }
}
