import type { CountryScopeType } from "./offer-invariants"

export type ModeBookableError =
  | "MODE_NOT_AVAILABLE_IN_COUNTRY"
  | "MODE_LANGUAGE_MISMATCH"
  | "MODE_INACTIVE"

export type ModeBookableInput = {
  active: boolean
  countryScopeType: CountryScopeType
  countryScopeCodes: string[]
  languages: string[]
  memberCountry: string
  language: string
}

export type ModeBookableResult =
  | { ok: true }
  | { ok: false; error: ModeBookableError }

function primaryLanguageTag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0] ?? ""
}

export function assertModeBookable(
  input: ModeBookableInput
): ModeBookableResult {
  if (!input.active) {
    return { ok: false, error: "MODE_INACTIVE" }
  }

  const country = input.memberCountry.trim().toUpperCase()
  if (input.countryScopeType === "list") {
    const scoped = new Set(
      input.countryScopeCodes.map((code) => code.trim().toUpperCase())
    )
    if (!scoped.has(country)) {
      return { ok: false, error: "MODE_NOT_AVAILABLE_IN_COUNTRY" }
    }
  }

  // event_type_modes.languages has CHECK cardinality >= 1. An empty list is
  // invalid data and must not be treated as unrestricted.
  const language = primaryLanguageTag(input.language)
  const supported = new Set(input.languages.map(primaryLanguageTag))
  if (language.length === 0 || !supported.has(language)) {
    return { ok: false, error: "MODE_LANGUAGE_MISMATCH" }
  }

  return { ok: true }
}
