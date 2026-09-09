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

const SLUG = "live-preview"

const FIELDS = [
  { key: "name" as const, label: "Display name", placeholder: "Dr. Ana Silva" },
  {
    key: "headline" as const,
    label: "Headline",
    placeholder: "Helping members build sustainable habits",
  },
  {
    key: "specialty" as const,
    label: "Specialty",
    placeholder: "Clinical nutrition",
  },
  {
    key: "sessionTitle" as const,
    label: "First session",
    placeholder: "Intro consultation",
  },
]

function LivePreviewContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))
  const field = FIELDS[step]

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  if (step >= FIELDS.length || !field) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <DraftSavedHandoff workspaceName={draft.name} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col md:w-1/2">
        <header className="border-b px-6 py-4">
          <Link
            href="/expert-onboarding"
            className="text-sm text-muted-foreground"
          >
            ← Hub
          </Link>
          <p className="mt-2 text-xs tracking-widest text-eleva-primary uppercase">
            O8 · Live preview
          </p>
        </header>
        <main className="flex flex-1 flex-col justify-center px-8">
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {FIELDS.length}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{field.label}</h1>
          <input
            value={(draft[field.key] as string) ?? ""}
            onChange={(e) => update({ [field.key]: e.target.value })}
            className="mt-6 w-full rounded-xl border px-4 py-3 text-lg"
            placeholder={field.placeholder}
          />
        </main>
        <footer className="flex justify-between border-t px-8 py-4">
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
        </footer>
      </div>
      <aside className="hidden flex-1 border-l bg-stone-100 p-8 md:block">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Member preview
        </p>
        <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="aspect-[16/10] bg-gradient-to-br from-eleva-primary/20 to-stone-200" />
          <div className="space-y-2 p-6">
            <h2
              className={cn(
                "text-xl font-semibold transition",
                field.key === "name" && "text-eleva-primary"
              )}
            >
              {draft.name || "Your name"}
            </h2>
            <p
              className={cn(
                "text-muted-foreground",
                field.key === "headline" &&
                  "rounded px-1 ring-2 ring-eleva-primary/30"
              )}
            >
              {draft.headline || "Headline appears here"}
            </p>
            <span
              className={cn(
                "inline-block rounded-full bg-muted px-3 py-1 text-xs",
                field.key === "specialty" && "ring-2 ring-eleva-primary"
              )}
            >
              {draft.specialty || "Specialty"}
            </span>
            <div
              className={cn(
                "mt-4 rounded-xl border p-4",
                field.key === "sessionTitle" && "border-eleva-primary"
              )}
            >
              <p className="font-medium">
                {draft.sessionTitle || "First session"}
              </p>
              <p className="text-sm text-muted-foreground">
                Book with this expert
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function LivePreviewLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <LivePreviewContent />
    </CreateSpaceGate>
  )
}
