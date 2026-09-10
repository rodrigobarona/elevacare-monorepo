const DATE_LOCALES: Record<string, string> = {
  pt: "pt-PT",
  es: "es-ES",
  en: "en-IE",
}

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
  const intlLocale = DATE_LOCALES[locale] ?? locale
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
