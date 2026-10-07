function displayName(
  type: "language" | "region",
  code: string,
  locale: string
): string {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) ?? code
  } catch {
    return code
  }
}

/** Localized language name for a BCP 47 code (`fr` → "francês" in `pt`). */
export function displayLanguage(code: string, locale: string): string {
  return displayName("language", code, locale)
}

/** Localized country name for an ISO 3166-1 alpha-2 code. */
export function displayRegion(code: string, locale: string): string {
  return displayName("region", code.toUpperCase(), locale)
}
