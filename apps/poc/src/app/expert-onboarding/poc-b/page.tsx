"use client"

import { useRouter } from "next/navigation"
import { WizardRunner } from "@/domains/expert-onboarding/components/wizard/wizard-runner"
import { POC_B_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-a-steps"

export default function PocBPage() {
  const router = useRouter()
  return (
    <WizardRunner
      pocId="poc-b"
      registry={POC_B_REGISTRY}
      variant="split"
      onExit={() => router.push("/expert-onboarding")}
    />
  )
}
