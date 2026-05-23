"use client"

import { useRouter } from "next/navigation"
import { WizardRunner } from "@/domains/expert-onboarding/components/wizard/wizard-runner"
import { POC_A_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-a-steps"

export default function PocAPage() {
  const router = useRouter()
  return (
    <WizardRunner
      pocId="poc-a"
      registry={POC_A_REGISTRY}
      variant="sidebar"
      onExit={() => router.push("/expert-onboarding")}
    />
  )
}
