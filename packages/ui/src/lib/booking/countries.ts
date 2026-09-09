export const BOOKING_COUNTRIES = [
  "PT",
  "ES",
  "FR",
  "DE",
  "IT",
  "GB",
  "IE",
  "NL",
  "BE",
  "LU",
  "AT",
  "CH",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "BR",
  "US",
  "CA",
  "MX",
  "AR",
  "CL",
  "CO",
  "PE",
  "AU",
] as const

export type BookingCountry = (typeof BOOKING_COUNTRIES)[number]

const COUNTRY_SET = new Set<string>(BOOKING_COUNTRIES)

export function normalizeCountry(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase() ?? ""
  if (COUNTRY_SET.has(code)) return code
  return "PT"
}

export function countryOptions(
  locale: string,
  extra: readonly string[] = []
): Array<{ code: string; label: string }> {
  const names = new Intl.DisplayNames([locale], { type: "region" })
  const codes = new Set<string>(BOOKING_COUNTRIES)
  for (const code of extra) {
    const upper = code.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(upper)) codes.add(upper)
  }
  return [...codes]
    .map((code) => ({
      code,
      label: names.of(code) ?? code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
}

export function isKnownBookingCountry(code: string): boolean {
  return COUNTRY_SET.has(code.toUpperCase())
}
