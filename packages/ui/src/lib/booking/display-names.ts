type DisplayType = "language" | "region"

const formatters = new Map<string, Intl.DisplayNames | null>()

function formatter(
  type: DisplayType,
  locale: string
): Intl.DisplayNames | null {
  const key = `${type}:${locale}`
  if (!formatters.has(key)) {
    let names: Intl.DisplayNames | null = null
    try {
      names = new Intl.DisplayNames([locale], { type })
    } catch {
      names = null
    }
    formatters.set(key, names)
  }
  return formatters.get(key) ?? null
}

function displayName(type: DisplayType, code: string, locale: string): string {
  try {
    return formatter(type, locale)?.of(code) ?? code
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
