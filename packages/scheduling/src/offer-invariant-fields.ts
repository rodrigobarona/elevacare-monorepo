import type { OfferInvariantError } from "./offer-invariants"

/** Form field keys on the expert delivery-mode panel. */
export type OfferInvariantField =
  | "mode"
  | "location"
  | "countries"
  | "worldwide"
  | "languages"

const CODE_TO_FIELD: Record<OfferInvariantError, OfferInvariantField> = {
  CLINICAL_WORLDWIDE: "worldwide",
  SCOPE_OUTSIDE_SERVICE_COUNTRIES: "countries",
  EMPTY_COUNTRY_LIST: "countries",
  WORLDWIDE_WITH_COUNTRY_LIST: "countries",
  IN_PERSON_COUNTRY_MISMATCH: "location",
  IN_PERSON_LOCATION_REQUIRED: "location",
  WORLDWIDE_REQUIRES_REMOTE: "worldwide",
  LANGUAGE_NOT_ON_PROFILE: "languages",
  EMPTY_LANGUAGE_LIST: "languages",
}

export function offerInvariantFieldForCode(
  code: OfferInvariantError
): OfferInvariantField {
  return CODE_TO_FIELD[code]
}

export function isOfferInvariantError(
  code: string
): code is OfferInvariantError {
  return code in CODE_TO_FIELD
}
