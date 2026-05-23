import type { ComponentType } from "react"
import type {
  ExpertDraft,
  Locale,
  PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"
import type { LocalizedField } from "@/domains/expert-onboarding/lib/draft-fields"

export type WizardVariant =
  | "sidebar"
  | "split"
  | "dots"
  | "minimal"
  | "event-first"
  | "express"

export type StepKind =
  | "interstitial"
  | "specialty-grid"
  | "chip-select"
  | "country-grid"
  | "city-search"
  | "text"
  | "textarea"
  | "stepper"
  | "yesno"
  | "languages"
  | "localized-field"
  | "upload"
  | "photo-review"
  | "address-search"
  | "map-confirm"
  | "credential-cards"
  | "earnings-info"
  | "event-summary"
  | "tax-id"
  | "license"
  | "terms"
  | "dark-review"
  | "post-submit"
  | "ai-bridge"
  | "dashboard-handoff"
  | "split-intro"
  | "ai-summary"

export type PreviewKey =
  | "specialty"
  | "headline"
  | "photos"
  | "bio"
  | "event"
  | "price"
  | "location"
  | "full"

export interface WizardChapter {
  id: string
  label: string
  icon?: ComponentType<{
    className?: string
    weight?: "regular" | "duotone" | "fill"
  }>
}

export interface GridOption {
  id: string
  label: string
}

export interface ChipOption {
  id: string
  label: string
}

export interface WizardStep {
  id: string
  chapterId?: string
  chapterLabel?: string
  stepInChapter?: number
  stepTotalInChapter?: number
  title: string
  helper?: string
  kind: StepKind
  optional?: boolean
  illustration?: string
  previewKey?: PreviewKey
  showSidebar?: boolean
  locale?: Locale
  minLength?: number
  maxLength?: number
  placeholder?: string
  showAi?: boolean
  gridOptions?: GridOption[]
  chipOptions?: ChipOption[]
  stepperMin?: number
  stepperMax?: number
  stepperSuffix?: string
  yesNoQuestion?: string
  /** For kind `localized-field` — which LocalizedString on ExpertDraft */
  localizedField?: LocalizedField
  multiline?: boolean
  canProceed: (draft: ExpertDraft) => boolean
}

export interface WizardRegistry {
  id: string
  steps: WizardStep[]
  chapters: WizardChapter[]
}

export const PRACTICE_COUNTRIES: PracticeCountry[] = ["PT", "ES", "BR"]

export const SESSION_FORMAT_OPTIONS: ChipOption[] = [
  { id: "online", label: "Online only" },
  { id: "in_person", label: "In person" },
  { id: "both", label: "Online & in person" },
]

export const LANGUAGE_OPTIONS: ChipOption[] = [
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
  { id: "es", label: "Español" },
]
