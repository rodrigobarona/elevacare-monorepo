"use client"

import * as React from "react"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"
import type { WizardVariant } from "@/lib/wizard-types"

interface WizardLayoutContextValue {
  variant: WizardVariant
  draft: ExpertDraft
  showSessionCard: boolean
}

const defaultDraft = {} as ExpertDraft

const WizardLayoutContext = React.createContext<WizardLayoutContextValue>({
  variant: "sidebar",
  draft: defaultDraft,
  showSessionCard: false,
})

export function WizardLayoutProvider({
  variant,
  draft,
  showSessionCard = false,
  children,
}: {
  variant: WizardVariant
  draft: ExpertDraft
  showSessionCard?: boolean
  children: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ variant, draft, showSessionCard }),
    [variant, draft, showSessionCard]
  )

  return (
    <WizardLayoutContext.Provider value={value}>
      {children}
    </WizardLayoutContext.Provider>
  )
}

export function useWizardLayout() {
  return React.useContext(WizardLayoutContext)
}
