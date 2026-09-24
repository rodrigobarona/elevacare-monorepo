/**
 * EU launch list for phone / service-country presets (D-02, offer fixtures).
 */
export const EU_SERVICE_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

export type EuServiceCountry = (typeof EU_SERVICE_COUNTRIES)[number]

/** Alias used by offer seed fixtures (same list). */
export const EU_PHONE_COUNTRIES = EU_SERVICE_COUNTRIES

export function euCountriesInService(
  serviceCountries: readonly string[]
): string[] {
  const allowed = new Set(serviceCountries.map((c) => c.toUpperCase()))
  return EU_SERVICE_COUNTRIES.filter((code) => allowed.has(code))
}
