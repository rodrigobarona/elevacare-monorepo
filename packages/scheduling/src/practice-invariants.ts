import {
  assertOfferInvariants,
  type OfferInvariantError,
  type OfferInvariantInput,
} from "./offer-invariants"

export type PracticeModeSnapshot = Omit<
  OfferInvariantInput,
  "worldwideRemote" | "serviceCountries" | "profileLanguages"
> & {
  modeId: string
  eventTypeId: string
  eventTypeTitle?: string | null
}

export type PracticeInvariantViolation = {
  modeId: string
  eventTypeId: string
  eventTypeTitle: string | null
  code: OfferInvariantError
  message: string
}

const MESSAGES: Record<OfferInvariantError, string> = {
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
 * Re-validate every published active mode against a candidate practice
 * profile. Returns human-readable violations for a 409 response — never
 * silently unpublishes.
 */
export function validatePracticeAgainstPublishedModes(input: {
  worldwideRemote: boolean
  serviceCountries: string[]
  profileLanguages: string[]
  modes: PracticeModeSnapshot[]
}): PracticeInvariantViolation[] {
  const violations: PracticeInvariantViolation[] = []

  for (const mode of input.modes) {
    const code = assertOfferInvariants({
      kind: mode.kind,
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
      eventTypeId: mode.eventTypeId,
      eventTypeTitle: mode.eventTypeTitle ?? null,
      code,
      message: MESSAGES[code],
    })
  }

  return violations
}
