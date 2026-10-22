import { defaultLocale, type Locale } from "@eleva/config/i18n"

/** Path prefix inside the docs app (basePath `/docs` is added by Next.js). */
export function docsLocalePrefix(locale: Locale): string {
  return locale === defaultLocale ? "" : `/${locale}`
}
