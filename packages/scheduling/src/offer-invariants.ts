export type OfferKind = "clinical" | "non_clinical"
export type CountryScopeType = "worldwide" | "list"
export type OfferMode = "online" | "phone" | "in_person"

export type OfferInvariantError =
  | "CLINICAL_WORLDWIDE"
  | "SCOPE_OUTSIDE_SERVICE_COUNTRIES"
  | "EMPTY_COUNTRY_LIST"
  | "WORLDWIDE_WITH_COUNTRY_LIST"
  | "IN_PERSON_COUNTRY_MISMATCH"
  | "WORLDWIDE_REQUIRES_REMOTE"
  | "LANGUAGE_NOT_ON_PROFILE"
  | "EMPTY_LANGUAGE_LIST"

export type OfferInvariantInput = {
  kind: OfferKind
  worldwideRemote: boolean
  serviceCountries: string[]
  profileLanguages: string[]
  mode: OfferMode
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  locationCountry?: string | null
}

export function assertOfferInvariants(
  input: OfferInvariantInput
): OfferInvariantError | null {
  if (
    input.countryScopeType === "list" &&
    input.countryScopeCodes.length === 0
  ) {
    return "EMPTY_COUNTRY_LIST"
  }

  if (
    input.countryScopeType === "worldwide" &&
    input.countryScopeCodes.length > 0
  ) {
    return "WORLDWIDE_WITH_COUNTRY_LIST"
  }

  if (input.kind === "clinical" && input.countryScopeType === "worldwide") {
    return "CLINICAL_WORLDWIDE"
  }

  if (
    input.kind === "non_clinical" &&
    input.countryScopeType === "worldwide" &&
    !input.worldwideRemote
  ) {
    return "WORLDWIDE_REQUIRES_REMOTE"
  }

  const service = new Set(input.serviceCountries.map(upper))
  if (input.countryScopeType === "list") {
    for (const code of input.countryScopeCodes) {
      if (!service.has(upper(code))) return "SCOPE_OUTSIDE_SERVICE_COUNTRIES"
    }
  }

  if (input.mode === "in_person") {
    const location = input.locationCountry ? upper(input.locationCountry) : null
    if (!location) return "IN_PERSON_COUNTRY_MISMATCH"
    // An in-person visit happens at one address, so a worldwide scope
    // cannot describe it. Require an explicit single-country list.
    if (input.countryScopeType === "worldwide") {
      return "IN_PERSON_COUNTRY_MISMATCH"
    }
    if (!service.has(location)) return "SCOPE_OUTSIDE_SERVICE_COUNTRIES"
    const scoped = input.countryScopeCodes.map(upper)
    if (scoped.length !== 1 || scoped[0] !== location) {
      return "IN_PERSON_COUNTRY_MISMATCH"
    }
  }

  if (input.languages.length === 0) return "EMPTY_LANGUAGE_LIST"

  const profileLangs = new Set(input.profileLanguages.map(lower))
  for (const language of input.languages) {
    if (!profileLangs.has(lower(language))) return "LANGUAGE_NOT_ON_PROFILE"
  }

  return null
}

function upper(value: string): string {
  return value.trim().toUpperCase()
}

function lower(value: string): string {
  return value.trim().toLowerCase()
}
