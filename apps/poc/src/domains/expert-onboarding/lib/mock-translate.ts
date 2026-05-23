import type { ExpertDraft, Locale } from "@/domains/expert-onboarding/lib/types"
import { SAMPLE_COPY } from "@/domains/expert-onboarding/lib/assets"
import type { LocalizedField } from "@/domains/expert-onboarding/lib/draft-fields"
import { setLocalized } from "@/domains/expert-onboarding/lib/draft-fields"

const LOCALES: Locale[] = ["en", "pt", "es"]

const SAMPLE_BIO: Record<Locale, string> = {
  en: "Warm, evidence-based support tailored to each member's journey.",
  pt: "Acompanhamento acolhedor e baseado em evidência, adaptado a cada membro.",
  es: "Apoyo cálido y basado en evidencia, adaptado a cada miembro.",
}

const SAMPLE_RECOGNITION: Record<Locale, string> = {
  en: "Featured speaker at regional women's health symposium.",
  pt: "Oradora convidada em simpósio regional de saúde da mulher.",
  es: "Ponente invitada en simposio regional de salud de la mujer.",
}

function getSampleForField(
  field: LocalizedField,
  locale: Locale
): string | null {
  if (field === "bio") return SAMPLE_BIO[locale]
  if (field === "recognition") return SAMPLE_RECOGNITION[locale]
  const sample = SAMPLE_COPY[field as keyof typeof SAMPLE_COPY]
  if (sample && typeof sample === "object" && locale in sample) {
    return (sample as Record<Locale, string>)[locale]
  }
  return null
}

export function mockTranslateLocalizedField(
  field: LocalizedField,
  sourceLocale: Locale,
  sourceText: string,
  targetLocales: Locale[]
): ExpertDraft[LocalizedField] {
  const sample = SAMPLE_COPY[field as keyof typeof SAMPLE_COPY]
  const result: ExpertDraft[LocalizedField] = { en: "", pt: "", es: "" }

  for (const locale of LOCALES) {
    if (locale === sourceLocale) {
      result[locale] = sourceText
    } else if (targetLocales.includes(locale)) {
      const fromSample = getSampleForField(field, locale)
      result[locale] =
        fromSample ??
        (sourceText.trim()
          ? `[${locale.toUpperCase()}] ${sourceText.slice(0, 120)}${sourceText.length > 120 ? "…" : ""}`
          : "")
    } else {
      result[locale] = ""
    }
  }

  return result
}

export function applyLocalizedTranslation(
  draft: ExpertDraft,
  field: LocalizedField,
  sourceLocale: Locale,
  sourceText: string,
  targetLocales: Locale[] = LOCALES.filter((l) => l !== sourceLocale)
): ExpertDraft {
  const translated = mockTranslateLocalizedField(
    field,
    sourceLocale,
    sourceText,
    targetLocales
  )
  return { ...draft, [field]: translated }
}

export function localizedFieldCanProceed(
  draft: ExpertDraft,
  field: LocalizedField,
  minLength: number,
  options?: { optional?: boolean; requireSessionLanguages?: boolean }
): boolean {
  if (options?.optional) return true

  const primaryText = draft[field][draft.primaryLocale]?.trim() ?? ""
  if (primaryText.length < minLength) return false

  if (options?.requireSessionLanguages === false) return true

  const minForLocale = Math.min(
    minLength,
    field === "headline" || field === "eventTitle" ? 5 : 8
  )

  return draft.languages.every(
    (locale) => (draft[field][locale]?.trim() ?? "").length >= minForLocale
  )
}

export function mergeLocalizedPatch(
  draft: ExpertDraft,
  field: LocalizedField,
  locale: Locale,
  value: string
): ExpertDraft {
  return setLocalized(draft, field, locale, value)
}
