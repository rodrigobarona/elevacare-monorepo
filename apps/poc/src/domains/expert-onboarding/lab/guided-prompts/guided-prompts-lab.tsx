"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { cn } from "@eleva/ui/lib/utils"
import { CreateSpaceGate } from "@/domains/expert-onboarding/lab/shared/create-space-gate"
import { DraftSavedHandoff } from "@/domains/expert-onboarding/lab/shared/draft-saved-handoff"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"

const SLUG = "guided-prompts"

const PROMPTS: { key: keyof LabDraft; label: string; placeholder: string }[] = [
  {
    key: "specialty",
    label: "What is your specialty?",
    placeholder: "Clinical nutrition",
  },
  {
    key: "practiceCountry",
    label: "Where do you practice?",
    placeholder: "PT",
  },
  { key: "city", label: "Which city?", placeholder: "Lisbon" },
  {
    key: "sessionTitle",
    label: "Name your first session",
    placeholder: "Intro consultation",
  },
  { key: "eventDuration", label: "How long is it?", placeholder: "45" },
  { key: "eventPrice", label: "What do you charge?", placeholder: "65" },
  {
    key: "name",
    label: "How should members see your name?",
    placeholder: "Dr. Ana Silva",
  },
  {
    key: "headline",
    label: "One-line headline",
    placeholder: "Helping members eat well for life",
  },
]

function GuidedPromptsContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))
  const prompt = PROMPTS[step]

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  if (step >= PROMPTS.length || !prompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 px-6">
        <DraftSavedHandoff workspaceName={draft.name} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 text-white">
      <header className="px-6 py-4">
        <Link
          href="/expert-onboarding"
          className="text-sm text-stone-400 hover:text-white"
        >
          ← Hub
        </Link>
        <p className="mt-2 text-xs tracking-widest text-stone-500 uppercase">
          O10 · Guided prompts
        </p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <h1 className="max-w-xl text-center text-3xl font-semibold md:text-4xl">
          {prompt.label}
        </h1>
        {prompt.key === "practiceCountry" ? (
          <div className="mt-10 flex gap-3">
            {(["PT", "ES", "BR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ practiceCountry: c })}
                className={cn(
                  "rounded-full px-8 py-3 text-lg font-medium",
                  draft.practiceCountry === c
                    ? "bg-white text-stone-900"
                    : "border border-stone-600"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <input
            value={String(draft[prompt.key] ?? "")}
            onChange={(e) => {
              const val =
                prompt.key === "eventDuration" || prompt.key === "eventPrice"
                  ? Number(e.target.value)
                  : e.target.value
              update({ [prompt.key]: val })
            }}
            className="mt-10 w-full max-w-md border-0 border-b-2 border-stone-600 bg-transparent py-3 text-center text-2xl outline-none focus:border-white"
            placeholder={prompt.placeholder}
            autoFocus
          />
        )}
      </main>
      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-6">
          <div className="flex gap-2">
            {PROMPTS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full",
                  i <= step ? "bg-white" : "bg-stone-600"
                )}
              />
            ))}
          </div>
          <div className="flex w-full justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-stone-400 disabled:invisible"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-white px-8 py-2.5 text-sm font-medium text-stone-900"
            >
              Continue
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function GuidedPromptsLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <GuidedPromptsContent />
    </CreateSpaceGate>
  )
}
