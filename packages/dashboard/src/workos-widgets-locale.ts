import { normalizeLocale } from "@eleva/config/i18n"
import { type LocaleCode, isValidLocale } from "@workos-inc/widgets-i18n"

const DEFAULT_WORKOS_LOCALE = "en-US" satisfies LocaleCode

/**
 * Map Eleva launch locales to WorkOS Widgets BCP-47 codes.
 * Eleva `pt` is European Portuguese (pt-PT), not pt-BR.
 */
export function resolveWorkOSWidgetsLocale(locale: string): LocaleCode {
  const normalized = normalizeLocale(locale)
  if (normalized === "pt") return "pt-PT"

  if (isValidLocale(locale)) return locale

  return DEFAULT_WORKOS_LOCALE
}
