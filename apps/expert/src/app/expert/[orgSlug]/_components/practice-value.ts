/**
 * Practice form values and the rules shared by setup and the profile
 * settings. A plain module (not "use client") so server pages can build
 * the initial value.
 */

export interface PracticeValue {
  practiceCountry: string
  serviceCountries: string[]
  languages: string[]
  worldwideRemote: boolean
}

export function uniqueUpper(codes: string[]): string[] {
  return [...new Set(codes.map((c) => c.toUpperCase()))]
}

/** The persisted practice as form state: the base country is always served. */
export function initialPracticeValue(input: {
  practiceCountry: string | null | undefined
  serviceCountries: string[]
  languages: string[]
  worldwideRemote: boolean
}): PracticeValue {
  const base = (input.practiceCountry ?? "").toUpperCase()
  return {
    practiceCountry: base,
    serviceCountries: uniqueUpper(
      input.serviceCountries.length > 0
        ? input.serviceCountries
        : base
          ? [base]
          : []
    ),
    languages: input.languages,
    worldwideRemote: input.worldwideRemote,
  }
}

/** What to send: the base country is always in the served list. */
export function practicePayload(value: PracticeValue): PracticeValue {
  return {
    ...value,
    serviceCountries: uniqueUpper(
      value.serviceCountries.includes(value.practiceCountry)
        ? value.serviceCountries
        : [...value.serviceCountries, value.practiceCountry]
    ),
  }
}

export function isPracticeComplete(value: PracticeValue): boolean {
  return value.practiceCountry.length > 0 && value.languages.length > 0
}

export function samePractice(a: PracticeValue, b: PracticeValue): boolean {
  const set = (list: string[]) => [...list].sort().join(",")
  return (
    a.practiceCountry === b.practiceCountry &&
    a.worldwideRemote === b.worldwideRemote &&
    set(a.serviceCountries) === set(b.serviceCountries) &&
    set(a.languages) === set(b.languages)
  )
}

/** A country or language name in the reader's language, capitalised. */
export function displayName(names: Intl.DisplayNames, code: string): string {
  let name = code
  try {
    name = names.of(code) ?? code
  } catch {
    // Unknown code: show it as is.
  }
  return name.charAt(0).toLocaleUpperCase() + name.slice(1)
}

/** Languages and countries that `next` drops compared with `saved`. */
export function removedFromPractice(
  saved: PracticeValue,
  next: PracticeValue
): { languages: string[]; countries: string[] } {
  return {
    languages: saved.languages.filter((l) => !next.languages.includes(l)),
    countries: saved.serviceCountries.filter(
      (c) => !next.serviceCountries.includes(c)
    ),
  }
}
