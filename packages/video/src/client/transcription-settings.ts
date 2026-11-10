/**
 * Live transcript settings (Daily → Deepgram, processed in the EU).
 *
 * Single source of truth for which speech-to-text model and language a
 * session uses. The call UI, the fallback chain and the transcript markers
 * all read from here, so swapping a model is a one-line change.
 *
 * Tiers, best first:
 * - `medical`: `nova-3-medical` + `language=multi` — clinical vocabulary,
 *   detects and follows the languages in {@link MEDICAL_AUTO_LANGUAGES}.
 *   Deepgram documents `language_hint` for `nova-3` only, so none is sent.
 * - `general`: `nova-3` + `language=multi` + `language_hint` (the booked
 *   language). For languages the medical model does not cover, and the
 *   first fallback when the medical model is refused.
 * - `legacy`: `nova-2` with one fixed language. Last fallback.
 */

export type TranscriptLanguageMode = "auto" | "english"
export type TranscriptModelTier = "medical" | "general" | "legacy"

export type TranscriptSettings = {
  mode: TranscriptLanguageMode
  tier: TranscriptModelTier
}

export type DailyTranscriptionStartOptions = {
  transcription_geo: "eu"
  model: string
  language: string
  punctuate: true
  /** Deepgram's raw result carries the detected `languages`. */
  includeRawResponse: true
  extra?: { language_hint: string }
}

/** `nova-3-medical` with `language=multi` (Deepgram, 2026-10). */
export const MEDICAL_AUTO_LANGUAGES: ReadonlySet<string> = new Set([
  "en",
  "es",
  "fr",
  "de",
  "hi",
  "ru",
  "pt",
  "ja",
  "it",
  "nl",
])

/**
 * Base codes `nova-3` accepts as `language_hint`. Any other hint makes
 * Deepgram reject the stream (HTTP 400), so hints are only sent from here.
 */
export const GENERAL_HINT_LANGUAGES: ReadonlySet<string> = new Set([
  "af",
  "ar",
  "be",
  "bn",
  "bs",
  "bg",
  "ca",
  "zh",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "gu",
  "he",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "kn",
  "ko",
  "lv",
  "lt",
  "mk",
  "ms",
  "mr",
  "no",
  "fa",
  "pl",
  "pt",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sv",
  "tl",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
  "xh",
  "zu",
])

const MODEL_BY_TIER: Record<TranscriptModelTier, string> = {
  medical: "nova-3-medical",
  general: "nova-3",
  legacy: "nova-2",
}

const TIER_ORDER: readonly TranscriptModelTier[] = [
  "medical",
  "general",
  "legacy",
]

/** Eleva's sessions default to Portuguese when nothing else is known. */
const DEFAULT_SESSION_LANGUAGE = "pt"

/** Final lines kept to show the detected language without flicker. */
export const DETECTED_LANGUAGE_WINDOW = 10

/** English-only lines in a row before we suggest the English model. */
export const ENGLISH_SUGGESTION_MIN_LINES = 10

export function primaryLanguage(tag: unknown): string | null {
  if (typeof tag !== "string") return null
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0]
  return primary && /^[a-z]{2,3}$/.test(primary) ? primary : null
}

/** Best tier for the booked language before anything has failed. */
export function initialModelTier(
  sessionLanguage: unknown
): TranscriptModelTier {
  const primary = primaryLanguage(sessionLanguage)
  if (!primary || MEDICAL_AUTO_LANGUAGES.has(primary)) return "medical"
  if (GENERAL_HINT_LANGUAGES.has(primary)) return "general"
  return "legacy"
}

export function nextModelTier(
  tier: TranscriptModelTier
): TranscriptModelTier | null {
  return TIER_ORDER[TIER_ORDER.indexOf(tier) + 1] ?? null
}

export function isMedicalModel(model: unknown): boolean {
  return typeof model === "string" && model.includes("medical")
}

/** Whether the model reports the language it hears. */
export function detectsLanguage(settings: TranscriptSettings): boolean {
  return settings.mode === "auto" && settings.tier !== "legacy"
}

/** Fixed language the legacy model transcribes in. Eleva's Portuguese is European. */
export function legacyLanguageCode(sessionLanguage: unknown): string {
  const primary = primaryLanguage(sessionLanguage) ?? DEFAULT_SESSION_LANGUAGE
  return primary === "pt" ? "pt-PT" : primary
}

export function transcriptionOptions(
  input: TranscriptSettings & { sessionLanguage?: string | null }
): DailyTranscriptionStartOptions {
  const base = {
    transcription_geo: "eu",
    model: MODEL_BY_TIER[input.tier],
    punctuate: true,
    includeRawResponse: true,
  } as const
  if (input.mode === "english") return { ...base, language: "en" }
  if (input.tier === "legacy") {
    return { ...base, language: legacyLanguageCode(input.sessionLanguage) }
  }
  if (input.tier === "medical") return { ...base, language: "multi" }
  const hint = primaryLanguage(input.sessionLanguage)
  return hint && GENERAL_HINT_LANGUAGES.has(hint)
    ? { ...base, language: "multi", extra: { language_hint: hint } }
    : { ...base, language: "multi" }
}

/** Keeps the last few detected languages, newest last. */
export function rememberLanguage(
  recent: readonly string[],
  language: string
): string[] {
  return [...recent, language].slice(-DETECTED_LANGUAGE_WINDOW)
}

/** Most frequent recent language; ties go to the most recent one. */
export function dominantLanguage(recent: readonly string[]): string | null {
  let best: string | null = null
  let bestCount = 0
  const counts = new Map<string, number>()
  for (const language of recent) {
    const count = (counts.get(language) ?? 0) + 1
    counts.set(language, count)
    if (count >= bestCount) {
      best = language
      bestCount = count
    }
  }
  return best
}

/** Deepgram recommends its English model for English-only audio. */
export function suggestsEnglishOnly(
  settings: TranscriptSettings,
  recent: readonly string[]
): boolean {
  return (
    detectsLanguage(settings) &&
    recent.length >= ENGLISH_SUGGESTION_MIN_LINES &&
    recent.every((language) => language === "en")
  )
}

/**
 * Daily 0.93 `startTranscription` / `stopTranscription` return `undefined`
 * (results arrive as events) and throw synchronously before join. Wrap them
 * so callers can always `.catch()`.
 */
export function runDailyMethod(method: () => unknown): Promise<void> {
  return Promise.resolve()
    .then(method)
    .then(() => undefined)
}

/** Daily refuses a second start while a transcript is already running. */
export function isAlreadyRunningError(errorMsg: unknown): boolean {
  return typeof errorMsg === "string" && /already/i.test(errorMsg)
}
