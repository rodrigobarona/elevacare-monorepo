import {
  EXPERT_WIZARD_STEPS,
  type ExpertOnboardingStep,
} from "@eleva/api-client"

export const ONBOARDING_STEPS = EXPERT_WIZARD_STEPS

export type OnboardingStepName = Extract<
  ExpertOnboardingStep,
  (typeof EXPERT_WIZARD_STEPS)[number]
>

export const allowedOnboardingStepNames = new Set<string>(EXPERT_WIZARD_STEPS)
