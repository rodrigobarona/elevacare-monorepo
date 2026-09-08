/**
 * Locale union and per-app required-locale lists.
 *
 * `scripts/check-i18n-parity.mjs` reads this module — never hardcode the
 * list in the checker. `pt-BR` is retired (D-01); `fr` is not in the union.
 */

export const locales = ["en", "pt", "es"] as const
export type Locale = (typeof locales)[number]

export const REQUIRED_LOCALES_BY_APP = {
  default: ["pt", "en", "es"],
  admin: ["pt", "en"],
} as const satisfies Record<string, readonly Locale[]>

export type AppLocaleKey = keyof typeof REQUIRED_LOCALES_BY_APP

export function requiredLocalesForApp(appName: string): readonly Locale[] {
  if (
    Object.prototype.hasOwnProperty.call(REQUIRED_LOCALES_BY_APP, appName) &&
    appName !== "default"
  ) {
    return REQUIRED_LOCALES_BY_APP[appName as Exclude<AppLocaleKey, "default">]
  }
  return REQUIRED_LOCALES_BY_APP.default
}
