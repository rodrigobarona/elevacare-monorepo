const CURRENCY_LOCALES: Record<string, string> = {
  pt: "pt-PT",
  es: "es-ES",
  en: "en-IE",
}

export function formatEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(CURRENCY_LOCALES[locale] ?? locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}
