export type ModeBookableError =
  | "MODE_NOT_AVAILABLE_IN_COUNTRY"
  | "MODE_LANGUAGE_MISMATCH"
  | "MODE_INACTIVE"

export type ModeBookableInput = {
  active: boolean
  countryScopeType: "worldwide" | "list"
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

/** Client-safe copy of `@eleva/scheduling` `assertModeBookable`. */
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

  const language = primaryLanguageTag(input.language)
  const supported = new Set(input.languages.map(primaryLanguageTag))
  if (language.length === 0 || !supported.has(language)) {
    return { ok: false, error: "MODE_LANGUAGE_MISMATCH" }
  }

  return { ok: true }
}

export type BookableMode = {
  id: string
  active?: boolean
  countryScopeType: "worldwide" | "list"
  countryScopeCodes: string[]
  languages: string[]
}

export function evaluateModes<T extends BookableMode>(
  modes: readonly T[],
  input: { memberCountry: string; language: string }
): Array<{ mode: T; result: ModeBookableResult }> {
  return modes.map((mode) => ({
    mode,
    result: assertModeBookable({
      active: mode.active ?? true,
      countryScopeType: mode.countryScopeType,
      countryScopeCodes: mode.countryScopeCodes,
      languages: mode.languages,
      memberCountry: input.memberCountry,
      language: input.language,
    }),
  }))
}

export function bookableModes<T extends BookableMode>(
  modes: readonly T[],
  input: { memberCountry: string; language: string }
): T[] {
  return evaluateModes(modes, input)
    .filter((entry) => entry.result.ok)
    .map((entry) => entry.mode)
}

export function shouldSkipMeetStep<T extends BookableMode>(
  modes: readonly T[],
  input: { memberCountry: string; language: string }
): T | null {
  const bookable = bookableModes(modes, input)
  return bookable.length === 1 ? (bookable[0] ?? null) : null
}
