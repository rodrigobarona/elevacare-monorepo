import type { ExpertDraft, Locale } from "@/domains/expert-onboarding/lib/types"
import { SPECIALTIES } from "@/domains/expert-onboarding/lib/types"

export type LocalizedField =
  | "headline"
  | "qualifications"
  | "recognition"
  | "bio"
  | "eventTitle"
  | "eventDescription"

export function getLocalized(
  draft: ExpertDraft,
  field: LocalizedField,
  locale: Locale
): string {
  return draft[field][locale]
}

export function setLocalized(
  draft: ExpertDraft,
  field: LocalizedField,
  locale: Locale,
  value: string
): ExpertDraft {
  return {
    ...draft,
    [field]: { ...draft[field], [locale]: value },
  }
}

export function getSubSpecialtyOptions(
  specialtyId: string
): { id: string; label: string }[] {
  const spec = SPECIALTIES.find((s) => s.id === specialtyId)
  return (
    spec?.subs.map((sub) => ({
      id: sub.toLowerCase().replace(/\s+/g, "-"),
      label: sub,
    })) ?? []
  )
}
