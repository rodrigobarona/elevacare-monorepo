"use client"

import { CreateSpaceGate } from "@/domains/expert-onboarding/lab/shared/create-space-gate"
import { seedSetupDraft } from "@/domains/expert-onboarding/lab/shared/mock-storage"

interface SetupSpaceGateProps {
  slug: string
  children: React.ReactNode
}

/** Modal first, then seed draft — never auto-seed on page load. */
export function SetupSpaceGate({ slug, children }: SetupSpaceGateProps) {
  return (
    <CreateSpaceGate slug={slug} onEntered={() => seedSetupDraft(slug)}>
      {children}
    </CreateSpaceGate>
  )
}
