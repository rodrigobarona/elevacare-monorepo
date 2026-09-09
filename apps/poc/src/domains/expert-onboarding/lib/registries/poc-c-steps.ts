import { PEXELS } from "@/domains/expert-onboarding/lib/assets"
import { localizedFieldCanProceed } from "@/domains/expert-onboarding/lib/mock-translate"
import type { WizardRegistry, WizardStep } from "@/lib/wizard-types"
import { SESSION_FORMAT_OPTIONS } from "@/lib/wizard-types"

export const POC_C_STEPS: WizardStep[] = [
  {
    id: "c-0-hook",
    title: "Start with what members book",
    helper:
      "Define your first session first — we'll draft your profile from it.",
    kind: "interstitial",
    illustration: PEXELS.consultation,
    canProceed: () => true,
  },
  {
    id: "c-event-title",
    title: "Name your first session",
    helper: "Use tabs to write in EN, PT, or ES.",
    kind: "localized-field",
    localizedField: "eventTitle",
    previewKey: "event",
    placeholder: "Initial consultation — 50 min",
    minLength: 5,
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "eventTitle", 5, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "c-duration",
    title: "How long is this session?",
    kind: "stepper",
    stepperMin: 30,
    stepperMax: 120,
    stepperSuffix: "min",
    canProceed: (d) => d.eventDuration >= 30,
  },
  {
    id: "c-format",
    title: "How is this session delivered?",
    kind: "chip-select",
    chipOptions: SESSION_FORMAT_OPTIONS,
    canProceed: (d) => !!d.sessionMode,
  },
  {
    id: "c-price",
    title: "Price per session",
    kind: "stepper",
    previewKey: "price",
    stepperMin: 20,
    stepperMax: 300,
    stepperSuffix: "€",
    canProceed: (d) => d.eventPrice >= 20,
  },
  {
    id: "c-event-desc",
    title: "Describe this session",
    helper: "What happens in the first meeting? Translate with AI when ready.",
    kind: "localized-field",
    localizedField: "eventDescription",
    multiline: true,
    previewKey: "event",
    minLength: 20,
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "eventDescription", 20, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "c-ai-bridge",
    title: "Drafting your profile…",
    helper:
      "Using your session details to suggest headline and qualifications.",
    kind: "ai-bridge",
    canProceed: (d) => d.headline.en.trim().length >= 8,
  },
  {
    id: "c-upload",
    title: "Add at least 5 photos",
    kind: "upload",
    previewKey: "photos",
    canProceed: (d) => d.photos.length >= 5,
  },
  {
    id: "c-headline",
    title: "Your public headline",
    helper: "Use tabs to write in EN, PT, or ES.",
    kind: "localized-field",
    localizedField: "headline",
    previewKey: "headline",
    minLength: 8,
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "headline", 8, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "c-qual",
    title: "Your qualifications",
    kind: "localized-field",
    localizedField: "qualifications",
    multiline: true,
    minLength: 150,
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "qualifications", 150, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "c-dashboard",
    title: "Your workspace dashboard",
    kind: "dashboard-handoff",
    canProceed: () => true,
  },
]

export const POC_C_REGISTRY: WizardRegistry = {
  id: "poc-c",
  chapters: [],
  steps: POC_C_STEPS,
}
