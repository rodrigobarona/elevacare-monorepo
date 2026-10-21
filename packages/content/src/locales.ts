import { defaultLocale, locales, type Locale } from "@eleva/config/i18n"

/** Locales every public long-form document must ship in. */
export const CONTENT_LOCALES = locales

export type ContentLocale = Locale

export const DEFAULT_CONTENT_LOCALE: ContentLocale = defaultLocale

export function isContentLocale(value: string): value is ContentLocale {
  return (CONTENT_LOCALES as readonly string[]).includes(value)
}
