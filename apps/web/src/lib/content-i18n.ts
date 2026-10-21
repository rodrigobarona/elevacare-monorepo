import type { I18nConfig } from "fumadocs-core/i18n"
import { CONTENT_LOCALES } from "@eleva/content/locales"

/** Fumadocs locale dirs under each content collection (`en/`, `pt/`, `es/`). */
export const contentI18n: I18nConfig = {
  defaultLanguage: "en",
  languages: [...CONTENT_LOCALES],
  hideLocale: "default-locale",
  parser: "dir",
}
