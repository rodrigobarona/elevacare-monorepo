import type { SessionMode } from "@eleva/db"

/**
 * Marketplace whitelists shared by the server-side search-params parser
 * and the client-side filter UI. Single source of truth so both stay in
 * lockstep — adding a new locale or country only requires editing one
 * file.
 */
export const SESSION_MODES: readonly SessionMode[] = [
  "online",
  "in_person",
  "phone",
] as const

export const LANGUAGE_CODES = ["pt", "en", "es"] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export const COUNTRY_CODES = ["PT", "ES", "BR"] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

/**
 * Display-ready language options for `<Select>` controls. Values match
 * `LANGUAGE_CODES`; labels are looked up via `t(`locale.${labelKey}`)`.
 */
export const LANGUAGE_OPTIONS: readonly {
  value: LanguageCode
  labelKey: LanguageCode
}[] = [
  { value: "pt", labelKey: "pt" },
  { value: "en", labelKey: "en" },
  { value: "es", labelKey: "es" },
] as const
