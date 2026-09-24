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

/**
 * Mainland / primary IANA zone per EU service country.
 * Multi-zone countries (e.g. ES Canaries, PT Azores) stay editable in UI.
 */
export const EU_COUNTRY_DEFAULT_TIMEZONES: Record<EuServiceCountry, string> = {
  AT: "Europe/Vienna",
  BE: "Europe/Brussels",
  BG: "Europe/Sofia",
  HR: "Europe/Zagreb",
  CY: "Asia/Nicosia",
  CZ: "Europe/Prague",
  DK: "Europe/Copenhagen",
  EE: "Europe/Tallinn",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  GR: "Europe/Athens",
  HU: "Europe/Budapest",
  IE: "Europe/Dublin",
  IT: "Europe/Rome",
  LV: "Europe/Riga",
  LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg",
  MT: "Europe/Malta",
  NL: "Europe/Amsterdam",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  RO: "Europe/Bucharest",
  SK: "Europe/Bratislava",
  SI: "Europe/Ljubljana",
  ES: "Europe/Madrid",
  SE: "Europe/Stockholm",
}

export function defaultTimezoneForCountry(
  country: string,
  fallback = "Europe/Lisbon"
): string {
  const code = country.toUpperCase() as EuServiceCountry
  return EU_COUNTRY_DEFAULT_TIMEZONES[code] ?? fallback
}

export function euCountriesInService(
  serviceCountries: readonly string[]
): string[] {
  const allowed = new Set(serviceCountries.map((c) => c.toUpperCase()))
  return EU_SERVICE_COUNTRIES.filter((code) => allowed.has(code))
}
