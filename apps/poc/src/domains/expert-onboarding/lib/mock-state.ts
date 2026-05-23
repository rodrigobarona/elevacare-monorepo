"use client"

import * as React from "react"
import {
  createDefaultDraft,
  type ExpertDraft,
} from "@/domains/expert-onboarding/lib/types"

const STORAGE_PREFIX = "eleva-poc-expert:"

export function loadDraft(pocId: string): ExpertDraft {
  if (typeof window === "undefined") return createDefaultDraft()
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${pocId}`)
    if (!raw) return createDefaultDraft()
    return { ...createDefaultDraft(), ...JSON.parse(raw) } as ExpertDraft
  } catch {
    return createDefaultDraft()
  }
}

export function saveDraft(pocId: string, draft: ExpertDraft) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pocId}`, JSON.stringify(draft))
  } catch {
    /* quota / private mode */
  }
}

export function useExpertDraft(pocId: string) {
  const [draft, setDraft] = React.useState<ExpertDraft>(createDefaultDraft)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setDraft(loadDraft(pocId))
    setHydrated(true)
  }, [pocId])

  const updateDraft = React.useCallback(
    (patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)) => {
      setDraft((prev) => {
        const next =
          typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
        saveDraft(pocId, next)
        return next
      })
    },
    [pocId]
  )

  return { draft, updateDraft, hydrated }
}
