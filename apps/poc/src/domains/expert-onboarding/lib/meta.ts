import type { ComponentType } from "react"
import { EXPERT_ONBOARDING_WALKTHROUGHS } from "@/lib/poc-catalog"

/** @deprecated Use EXPERT_ONBOARDING_WALKTHROUGHS from @/lib/poc-catalog */
export const POCS = EXPERT_ONBOARDING_WALKTHROUGHS

export type PocSlug = (typeof EXPERT_ONBOARDING_WALKTHROUGHS)[number]["slug"]

export function getPoc(slug: string) {
  return EXPERT_ONBOARDING_WALKTHROUGHS.find((p) => p.slug === slug)
}

export type PocComponentProps = {
  onExit: () => void
}

export type PocComponent = ComponentType<PocComponentProps>
