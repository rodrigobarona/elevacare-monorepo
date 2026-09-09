import type { WizardRegistry, WizardStep } from "@/lib/wizard-types"
import { localizedFieldCanProceed } from "@/domains/expert-onboarding/lib/mock-translate"

export const POC_D_STEPS: WizardStep[] = [
  {
    id: "d-specialty",
    title: "What is your area of practice?",
    kind: "specialty-grid",
    canProceed: (d) => !!d.specialty,
  },
  {
    id: "d-country",
    title: "Where do you primarily practice?",
    kind: "country-grid",
    canProceed: (d) => !!d.practiceCountry,
  },
  {
    id: "d-name",
    title: "Name your expert workspace",
    kind: "text",
    placeholder: "Ana Silva Practice",
    canProceed: (d) => d.workspaceName.trim().length >= 3,
  },
  {
    id: "d-headline",
    title: "How would you describe yourself?",
    helper: "Use tabs to write in EN, PT, or ES.",
    kind: "localized-field",
    localizedField: "headline",
    minLength: 8,
    placeholder: "e.g. Compassionate women's health specialist",
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "headline", 8, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "d-event-title",
    title: "Name your first bookable session",
    kind: "localized-field",
    localizedField: "eventTitle",
    placeholder: "Initial consultation",
    minLength: 5,
    showAi: true,
    canProceed: (d) =>
      localizedFieldCanProceed(d, "eventTitle", 5, {
        requireSessionLanguages: false,
      }),
  },
  {
    id: "d-price",
    title: "Price per session",
    kind: "stepper",
    stepperMin: 20,
    stepperMax: 300,
    stepperSuffix: "€",
    canProceed: (d) => d.eventPrice >= 20,
  },
  {
    id: "d-telehealth",
    title: "Do you follow local telehealth regulations?",
    kind: "yesno",
    canProceed: (d) => d.telehealthAck !== null,
  },
  {
    id: "d-insurance",
    title: "Do you carry professional liability insurance?",
    kind: "yesno",
    canProceed: (d) => d.insuranceAck !== null,
  },
  {
    id: "d-terms",
    title: "Agree to expert terms",
    kind: "terms",
    canProceed: (d) => d.termsAccepted && d.complianceAck,
  },
  {
    id: "d-review",
    title: "Review and request to go live",
    kind: "dark-review",
    canProceed: () => true,
  },
  {
    id: "d-post",
    title: "Request sent",
    kind: "post-submit",
    canProceed: () => true,
  },
]

export const POC_D_REGISTRY: WizardRegistry = {
  id: "poc-d",
  chapters: [],
  steps: POC_D_STEPS,
}
