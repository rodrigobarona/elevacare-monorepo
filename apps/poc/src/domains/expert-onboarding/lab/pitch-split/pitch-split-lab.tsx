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

const SLUG = "pitch-split"

const STORY = [
  {
    when: "specialty",
    text: "Members discover you by specialty — your category appears in community search filters.",
  },
  {
    when: "headline",
    text: "Your headline is the first line on your public profile. Make it outcome-focused.",
  },
  {
    when: "session",
    text: "The session card shows duration, price, and what members can expect to leave with.",
  },
  {
    when: "done",
    text: "When published, members see a trusted expert profile — photos and compliance complete the picture.",
  },
]

function PitchSplitContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const storyKey =
    step === 0
      ? "specialty"
      : step === 1
        ? "headline"
        : step === 2
          ? "session"
          : "done"
  const story = STORY.find((s) => s.when === storyKey)

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col border-r border-stone-200 bg-white md:w-1/2">
        <header className="flex items-center justify-between px-6 py-4">
          <Link
            href="/expert-onboarding"
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            ← Hub
          </Link>
          <span className="text-xs tracking-widest text-stone-400 uppercase">
            O3 · Attio
          </span>
        </header>
        <main className="flex flex-1 flex-col justify-center px-8 py-12">
          {step === 0 && (
            <>
              <h1 className="text-2xl font-semibold">
                What&apos;s your specialty?
              </h1>
              <input
                value={draft.specialty ?? ""}
                onChange={(e) => update({ specialty: e.target.value })}
                className="mt-6 w-full border-b-2 border-stone-200 py-2 text-xl outline-none focus:border-stone-800"
                placeholder="Sleep coaching"
              />
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-semibold">Profile headline</h1>
              <textarea
                value={draft.headline ?? ""}
                onChange={(e) => update({ headline: e.target.value })}
                className="mt-6 w-full border-b-2 border-stone-200 py-2 text-lg outline-none focus:border-stone-800"
                rows={2}
                placeholder="Help members rebuild healthy sleep routines"
              />
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-semibold">First session</h1>
              <input
                value={draft.sessionTitle ?? ""}
                onChange={(e) => update({ sessionTitle: e.target.value })}
                className="mt-6 w-full border-b-2 border-stone-200 py-2 outline-none"
                placeholder="Sleep assessment · 60 min"
              />
              <input
                type="number"
                value={draft.eventPrice ?? ""}
                onChange={(e) => update({ eventPrice: Number(e.target.value) })}
                className="mt-4 w-32 border-b-2 border-stone-200 py-2 outline-none"
                placeholder="€"
              />
            </>
          )}
          {step === 3 && (
            <DraftSavedHandoff workspaceName={draft.workspaceName} />
          )}
        </main>
        {step < 3 && (
          <footer className="flex justify-between border-t px-8 py-4">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-stone-500 disabled:invisible"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="rounded-full bg-stone-900 px-6 py-2 text-sm text-white"
            >
              Continue
            </button>
          </footer>
        )}
      </div>

      <aside className="hidden flex-1 snap-y snap-mandatory overflow-y-auto bg-stone-100 md:block">
        <div className="sticky top-0 border-b border-stone-200 bg-stone-100/95 px-10 py-6 backdrop-blur">
          <p className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
            Member story
          </p>
          <p className="mt-2 font-serif text-lg text-stone-600 italic">
            {story?.text}
          </p>
        </div>
        <div className="space-y-6 p-10">
          <article
            className={cn(
              "rounded-2xl bg-white p-8 shadow-sm transition",
              storyKey === "specialty" && "ring-2 ring-stone-800"
            )}
          >
            <p className="text-xs text-stone-400 uppercase">Discovery</p>
            <h2 className="mt-2 font-serif text-2xl">
              {draft.specialty || "Your specialty"}
            </h2>
          </article>
          <article
            className={cn(
              "rounded-2xl bg-white p-8 shadow-sm",
              storyKey === "headline" && "ring-2 ring-stone-800"
            )}
          >
            <p className="text-xs text-stone-400 uppercase">Profile</p>
            <p className="mt-2 text-lg">
              {draft.headline || "Your headline will appear here"}
            </p>
          </article>
          <article
            className={cn(
              "rounded-2xl bg-white p-8 shadow-sm",
              storyKey === "session" && "ring-2 ring-stone-800"
            )}
          >
            <p className="text-xs text-stone-400 uppercase">Bookable session</p>
            <h3 className="mt-2 font-semibold">
              {draft.sessionTitle || "Session title"}
            </h3>
            <p className="mt-1 text-stone-500">
              {draft.eventPrice ? `€${draft.eventPrice}` : "Set a price"}
            </p>
          </article>
        </div>
      </aside>
    </div>
  )
}

export function PitchSplitLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <PitchSplitContent />
    </CreateSpaceGate>
  )
}
