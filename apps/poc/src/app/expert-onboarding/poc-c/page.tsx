"use client"

import { useRouter } from "next/navigation"
import { WizardRunner } from "@/domains/expert-onboarding/components/wizard/wizard-runner"
import { POC_C_REGISTRY } from "@/domains/expert-onboarding/lib/registries/poc-c-steps"

export default function PocCPage() {
  const router = useRouter()
  return (
    <WizardRunner
      pocId="poc-c"
      registry={POC_C_REGISTRY}
      variant="event-first"
      onExit={() => router.push("/expert-onboarding")}
    />
  )
}
