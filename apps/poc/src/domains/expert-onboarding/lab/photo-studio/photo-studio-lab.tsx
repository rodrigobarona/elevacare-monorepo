"use client"

import { useCallback, useState } from "react"
import { cn } from "@eleva/ui/lib/utils"
import { SetupSpaceGate } from "@/domains/expert-onboarding/lab/shared/setup-space-gate"
import { SetupLabShell } from "@/domains/expert-onboarding/lab/shared/setup-lab-shell"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"

const SLUG = "photo-studio"

function PhotoStudioContent() {
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))
  const [count, setCount] = useState(0)

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  return (
    <SetupLabShell draft={draft} labLabel="S6 · Photo studio">
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Profile photos</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a cover and upload at least 5 photos (mock).
        </p>
        <div className="mt-6 aspect-[16/9] rounded-2xl bg-gradient-to-br from-stone-200 to-stone-300" />
        <div className="mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCount((c) => Math.min(5, c + 1))
                if (count + 1 >= 5) update({ photosDone: true })
              }}
              className={cn(
                "aspect-square rounded-lg border-2 border-dashed",
                i < count
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-stone-300"
              )}
            />
          ))}
        </div>
        {draft.photosDone ? (
          <p className="mt-4 text-sm text-emerald-700">Minimum photos met</p>
        ) : (
          <p className="mt-4 text-sm text-stone-500">{count}/5 added</p>
        )}
      </div>
    </SetupLabShell>
  )
}

export function PhotoStudioLab() {
  return (
    <SetupSpaceGate slug={SLUG}>
      <PhotoStudioContent />
    </SetupSpaceGate>
  )
}
