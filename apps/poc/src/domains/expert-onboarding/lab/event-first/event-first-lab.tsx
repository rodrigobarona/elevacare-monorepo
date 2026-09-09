"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { cn } from "@eleva/ui/lib/utils"
import { CreateSpaceGate } from "@/domains/expert-onboarding/lab/shared/create-space-gate"
import { DraftSavedHandoff } from "@/domains/expert-onboarding/lab/shared/draft-saved-handoff"
import { EventPipelineBar } from "@/domains/expert-onboarding/components/wizard/event-pipeline-bar"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"

const SLUG = "event-first"

const STAGES = ["session", "profile", "gallery", "launch"] as const

function EventFirstContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const stage = STAGES[Math.min(step, STAGES.length - 1)] ?? "session"

  if (step >= 4) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <DraftSavedHandoff
          summary={`Session "${draft.sessionTitle ?? "Intro"}" saved · profile bridge complete.`}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link
          href="/expert-onboarding"
          className="text-sm text-muted-foreground"
        >
          ← Hub
        </Link>
        <p className="mt-2 text-xs tracking-widest uppercase">
          O9 · Event first
        </p>
        <EventPipelineBar activeStage={stage} className="mt-4" />
      </header>
      <main className="mx-auto max-w-lg px-6 py-12">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold">
              What will members book first?
            </h1>
            <input
              value={draft.sessionTitle ?? ""}
              onChange={(e) => update({ sessionTitle: e.target.value })}
              className="mt-6 w-full rounded-xl border px-4 py-3"
              placeholder="Intro consultation · 45 min"
            />
            <div className="mt-4 flex gap-3">
              <input
                type="number"
                value={draft.eventDuration ?? 45}
                onChange={(e) =>
                  update({ eventDuration: Number(e.target.value) })
                }
                className="w-24 rounded-xl border px-3 py-3"
              />
              <input
                type="number"
                value={draft.eventPrice ?? ""}
                onChange={(e) => update({ eventPrice: Number(e.target.value) })}
                className="flex-1 rounded-xl border px-4 py-3"
                placeholder="Price €"
              />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold">Bridge to your profile</h1>
            <input
              value={draft.name ?? ""}
              onChange={(e) => update({ name: e.target.value })}
              className="mt-6 w-full rounded-xl border px-4 py-3"
              placeholder="Your name"
            />
            <input
              value={draft.specialty ?? ""}
              onChange={(e) => update({ specialty: e.target.value })}
              className="mt-4 w-full rounded-xl border px-4 py-3"
              placeholder="Specialty"
            />
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold">Practice location</h1>
            <div className="mt-6 flex gap-2">
              {(["PT", "ES", "BR"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ practiceCountry: c })}
                  className={cn(
                    "flex-1 rounded-xl border py-3 font-medium",
                    draft.practiceCountry === c
                      ? "border-stone-900 bg-stone-900 text-white"
                      : ""
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold">Headline for members</h1>
            <textarea
              value={draft.headline ?? ""}
              onChange={(e) => update({ headline: e.target.value })}
              className="mt-6 w-full rounded-xl border px-4 py-3"
              rows={3}
              placeholder="Outcome-focused headline"
            />
          </>
        )}
      </main>
      <footer className="fixed inset-x-0 bottom-0 border-t bg-background px-6 py-4">
        <div className="mx-auto flex max-w-lg justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="text-sm disabled:invisible"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-full bg-stone-900 px-6 py-2 text-sm text-white"
          >
            Continue
          </button>
        </div>
      </footer>
    </div>
  )
}

export function EventFirstLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <EventFirstContent />
    </CreateSpaceGate>
  )
}
