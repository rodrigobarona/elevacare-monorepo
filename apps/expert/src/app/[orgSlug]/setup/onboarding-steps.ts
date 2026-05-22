export const ONBOARDING_STEPS = [
  "profile",
  "connect",
  "identity",
  "invoicing",
  "schedule",
] as const

export type OnboardingStepName = (typeof ONBOARDING_STEPS)[number]

export const allowedOnboardingStepNames = new Set<string>(ONBOARDING_STEPS)
