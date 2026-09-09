import { locales } from "@eleva/config/i18n"

export function localePath(locale: string, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (locale === "en") return path
  return `/${locale}${path}`
}

export function hreflangLanguages(pathname: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": localePath("en", pathname),
  }
  for (const locale of locales) {
    languages[locale] = localePath(locale, pathname)
  }
  return languages
}
