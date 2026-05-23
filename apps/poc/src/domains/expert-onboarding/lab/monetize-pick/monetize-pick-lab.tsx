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

const SLUG = "monetize-pick"

const TIERS = [
  {
    id: "community" as const,
    title: "Community Expert",
    fee: "12% platform fee",
    bullets: ["Free to start", "Community discovery", "Standard payouts"],
  },
  {
    id: "growth" as const,
    title: "Growth",
    fee: "15% · intro offers",
    bullets: ["Featured in category", "Intro session promos", "Analytics"],
  },
  {
    id: "insurance" as const,
    title: "Insurance-ready",
    fee: "Custom · compliance review",
    bullets: [
      "Insurance billing support",
      "Enhanced verification",
      "Priority support",
    ],
  },
]

function MonetizePickContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const tier = draft.tier

  return (
    <div className="min-h-screen bg-teal-950 text-teal-50">
      <header className="px-6 py-5">
        <Link
          href="/expert-onboarding"
          className="text-sm text-teal-400 hover:text-white"
        >
          ← Hub
        </Link>
        <p className="mt-4 text-xs tracking-widest text-teal-500 uppercase">
          O7 · Wise
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 pb-24">
        {step === 0 && (
          <>
            <h1 className="text-3xl font-semibold">How do you want to grow?</h1>
            <p className="mt-3 text-teal-300">
              Pick a monetization path — you can change later.
            </p>
            <div className="mt-10 space-y-4">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update({ tier: t.id })}
                  className={cn(
                    "w-full rounded-2xl border p-6 text-left transition",
                    tier === t.id
                      ? "border-teal-400 bg-teal-900/80"
                      : "border-teal-800 bg-teal-900/30 hover:border-teal-600"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold">{t.title}</h2>
                    <span className="shrink-0 text-sm text-teal-400">
                      {t.fee}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-1 text-sm text-teal-300">
                    {t.bullets.map((b) => (
                      <li key={b}>· {b}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold">Quick profile</h1>
            <input
              value={draft.name ?? ""}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Your name"
              className="mt-6 w-full rounded-xl border border-teal-700 bg-teal-900/50 px-4 py-3 outline-none"
            />
            <input
              value={draft.specialty ?? ""}
              onChange={(e) => update({ specialty: e.target.value })}
              placeholder="Specialty"
              className="mt-4 w-full rounded-xl border border-teal-700 bg-teal-900/50 px-4 py-3 outline-none"
            />
          </>
        )}

        {step === 2 && (
          <DraftSavedHandoff
            workspaceName={draft.workspaceName}
            summary={`${TIERS.find((t) => t.id === tier)?.title ?? "Community Expert"} tier selected · finish setup to publish.`}
          />
        )}
      </main>

      {step < 2 && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-teal-800 bg-teal-950/95 px-6 py-4">
          <div className="mx-auto flex max-w-3xl justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-teal-400 disabled:invisible"
            >
              Back
            </button>
            <button
              type="button"
              disabled={step === 0 && !tier}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-full bg-teal-400 px-8 py-2.5 text-sm font-medium text-teal-950 disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}

export function MonetizePickLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <MonetizePickContent />
    </CreateSpaceGate>
  )
}
