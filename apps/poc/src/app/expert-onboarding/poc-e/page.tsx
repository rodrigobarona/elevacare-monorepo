"use client"

import { useRouter } from "next/navigation"
import { PocEExpressComplete } from "@/domains/expert-onboarding/components/pocs/poc-e-express-complete"

export default function PocEPage() {
  const router = useRouter()
  return (
    <PocEExpressComplete onExit={() => router.push("/expert-onboarding")} />
  )
}
