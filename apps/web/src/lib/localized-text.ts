import type { Locale } from "@eleva/config/i18n"

export type LocalizedText = {
  en: string
  pt?: string
  es?: string
}

export function pickLocalizedText(text: LocalizedText, locale: string): string {
  if (locale === "pt" && text.pt) return text.pt
  if (locale === "es" && text.es) return text.es
  return text.en
}

export function isSupportedLocale(locale: string): locale is Locale {
  return locale === "en" || locale === "pt" || locale === "es"
}
