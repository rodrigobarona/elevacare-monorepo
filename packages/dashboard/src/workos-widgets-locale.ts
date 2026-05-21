import { normalizeLocale } from "@eleva/config/i18n"
import { type LocaleCode, isValidLocale } from "@workos-inc/widgets-i18n"

const DEFAULT_WORKOS_LOCALE = "en-US" satisfies LocaleCode

/** Map Eleva launch locales to WorkOS Widgets BCP-47 codes. */
const BASE_LOCALE_MAP: Record<string, LocaleCode> = {
  pt: "pt-PT",
  es: "es-ES",
  en: "en-US",
}

/**
 * Map Eleva launch locales to WorkOS Widgets BCP-47 codes.
 * Eleva `pt` is European Portuguese (pt-PT), not pt-BR.
 */
export function resolveWorkOSWidgetsLocale(locale: string): LocaleCode {
  const normalized = normalizeLocale(locale)
  if (!normalized) return DEFAULT_WORKOS_LOCALE

  const mapped = BASE_LOCALE_MAP[normalized] ?? normalized
  return isValidLocale(mapped) ? mapped : DEFAULT_WORKOS_LOCALE
}
