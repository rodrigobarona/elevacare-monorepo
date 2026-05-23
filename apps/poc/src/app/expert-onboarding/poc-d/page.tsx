"use client"

import { useRouter } from "next/navigation"
import { WizardRunner } from "@/domains/expert-onboarding/components/wizard/wizard-runner"
import { POC_D_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-d-steps"

export default function PocDPage() {
  const router = useRouter()
  return (
    <WizardRunner
      pocId="poc-d"
      registry={POC_D_REGISTRY}
      variant="dots"
      onExit={() => router.push("/expert-onboarding")}
    />
  )
}
