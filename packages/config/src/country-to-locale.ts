import { defaultLocale, type Locale } from "./i18n"

/**
 * Map an ISO-3166 alpha-2 country code to the launch locale.
 * - PT -> pt
 * - BR -> pt (Portuguese-speaking market)
 * - ES -> es
 * - everything else -> en (default)
 *
 * Used by next-intl middleware and signup flow to pre-select a locale
 * from the request's CloudFront/Vercel geo header before the cookie is
 * set.
 */
export function countryToLocale(country: string | undefined | null): Locale {
  if (!country) return defaultLocale
  const upper = country.toUpperCase()
  switch (upper) {
    case "PT":
    case "BR":
      return "pt"
    case "ES":
    case "MX":
    case "AR":
    case "CL":
    case "CO":
    case "PE":
      return "es"
    default:
      return defaultLocale
  }
}
