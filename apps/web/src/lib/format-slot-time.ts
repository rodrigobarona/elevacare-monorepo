import { intlLocale as toIntlLocale } from "@eleva/config/i18n"

/**
 * Format a slot instant for display.
 *
 * Do not pass `dateStyle`/`timeStyle` together with `timeZoneName` on one
 * `Intl.DateTimeFormat` — that combination throws in some engines.
 */
export function formatSlotDateTime(
  iso: string,
  locale: string,
  timeZone: string
): string {
  const date = new Date(iso)
  const intlLocale = toIntlLocale(locale)
  const dateTime = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date)
  const zone = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value
  return zone ? `${dateTime} ${zone}` : dateTime
}
