import type { WizardRegistry, WizardStep } from "@/lib/wizard-types"

export const POC_E_EXPRESS_STEPS: WizardStep[] = [
  {
    id: "e-specialty",
    title: "What is your area of practice?",
    kind: "specialty-grid",
    canProceed: (d) => !!d.specialty,
  },
  {
    id: "e-country",
    title: "Where do you primarily practice?",
    kind: "country-grid",
    canProceed: (d) => !!d.practiceCountry,
  },
  {
    id: "e-express-name",
    title: "Name your expert workspace",
    kind: "text",
    placeholder: "Ana Silva Practice",
    canProceed: (d) => d.workspaceName.trim().length >= 3,
  },
  {
    id: "e-ai-summary",
    title: "Your AI draft profile",
    helper:
      "Review and create your workspace — complete the rest from your dashboard.",
    kind: "ai-summary",
    canProceed: () => true,
  },
  {
    id: "e-dashboard",
    title: "Your workspace dashboard",
    kind: "dashboard-handoff",
    canProceed: () => true,
  },
]

export const POC_E_EXPRESS_REGISTRY: WizardRegistry = {
  id: "poc-e-express",
  chapters: [],
  steps: POC_E_EXPRESS_STEPS,
}
