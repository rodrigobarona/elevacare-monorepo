export function formatEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-PT" : locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}
