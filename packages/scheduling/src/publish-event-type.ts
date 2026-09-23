import {
  assertOfferInvariants,
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

const INVARIANT_MESSAGES: Record<OfferInvariantError, string> = {
  CLINICAL_WORLDWIDE:
    "Clinical services cannot be offered worldwide. Limit the mode to countries you are licensed to serve.",
  SCOPE_OUTSIDE_SERVICE_COUNTRIES:
    "This mode targets a country outside your declared service countries. Update practice countries or the mode scope.",
  EMPTY_COUNTRY_LIST:
    "This mode needs at least one country when scope is a country list.",
  WORLDWIDE_WITH_COUNTRY_LIST:
    "Worldwide scope cannot also list specific countries.",
  IN_PERSON_COUNTRY_MISMATCH:
    "In-person modes must target exactly the location country.",
  IN_PERSON_LOCATION_REQUIRED: "In-person modes need a practice location.",
  WORLDWIDE_REQUIRES_REMOTE:
    "Worldwide remote requires worldwideRemote on your practice profile.",
  LANGUAGE_NOT_ON_PROFILE:
    "This mode uses a language that is not on your practice profile.",
  EMPTY_LANGUAGE_LIST: "Each delivery mode needs at least one language.",
}

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
      message: INVARIANT_MESSAGES[code],
    })
  }

  if (violations.length > 0) return { ok: false, violations }
  return { ok: true }
}
