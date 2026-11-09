import { intlLocale } from "@eleva/config/i18n"

/**
 * "2026-11-07" → "7 November 2026" / "7 de novembro de 2026", in the page
 * language with EU date order (`intlLocale`, not the US default for "en").
 */
export function formatLastUpdated(locale: string, isoDate: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`))
}
