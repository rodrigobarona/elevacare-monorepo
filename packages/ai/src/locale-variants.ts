const LOCALE_VARIANTS: Record<string, string> = {
  en: "English",
  pt: "European Portuguese, as written in Portugal (not Brazilian Portuguese)",
  es: "Spanish, as written in Spain",
}

/** Prompt label for a locale code, naming the regional variant Eleva writes in. */
export function describeLocale(locale: string | undefined): string {
  const code = locale?.trim() ?? ""
  const variant = LOCALE_VARIANTS[code.toLowerCase()]
  return variant ? `${code} (${variant})` : code
}
