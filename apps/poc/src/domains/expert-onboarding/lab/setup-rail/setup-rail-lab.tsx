"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { CreateSpaceGate } from "@/domains/expert-onboarding/lab/shared/create-space-gate"
import { DraftSavedHandoff } from "@/domains/expert-onboarding/lab/shared/draft-saved-handoff"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"

const SLUG = "setup-rail"

const RAIL = [
  { id: "practice", label: "Practice", desc: "Specialty & location" },
  { id: "offer", label: "First offer", desc: "Session members book" },
  { id: "identity", label: "Identity", desc: "Name & headline" },
  { id: "handoff", label: "Draft saved", desc: "Explore setup gallery" },
] as const

function SetupRailContent() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const canContinue =
    step === 0
      ? Boolean(draft.specialty && draft.practiceCountry)
      : step === 1
        ? Boolean(draft.sessionTitle)
        : step === 2
          ? Boolean(draft.name && draft.headline)
          : true

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 p-6 text-white md:flex">
        <Link
          href="/expert-onboarding"
          className="text-xs text-slate-400 hover:text-white"
        >
          ← Hub
        </Link>
        <p className="mt-6 text-xs font-semibold tracking-widest text-slate-500 uppercase">
          O1 · Remote rail
        </p>
        <h1 className="mt-2 text-lg font-semibold">Expert Space onboarding</h1>
        <nav className="mt-10 space-y-1">
          {RAIL.map((item, i) => {
            const done = i < step
            const active = i === step
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-3",
                  active && "bg-white/10",
                  !active && !done && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-white text-slate-900"
                        : "border border-slate-600"
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4 md:hidden">
          <p className="text-sm font-medium">
            Step {step + 1} · {RAIL[step]?.label}
          </p>
        </header>

        <main className="flex flex-1 flex-col justify-center px-6 py-12 md:px-16">
          {step === 0 && (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-2xl font-semibold text-slate-900">
                Your practice
              </h2>
              <p className="mt-2 text-slate-500">
                Where and what you offer members.
              </p>
              <label className="mt-8 block text-sm font-medium">
                Specialty
              </label>
              <input
                value={draft.specialty ?? ""}
                onChange={(e) => update({ specialty: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3"
                placeholder="Clinical nutrition"
              />
              <label className="mt-4 block text-sm font-medium">Country</label>
              <div className="mt-2 flex gap-2">
                {(["PT", "ES", "BR"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update({ practiceCountry: c })}
                    className={cn(
                      "flex-1 rounded-lg border py-3 font-medium",
                      draft.practiceCountry === c
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                value={draft.city ?? ""}
                onChange={(e) => update({ city: e.target.value })}
                className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-3"
                placeholder="City (optional)"
              />
            </div>
          )}

          {step === 1 && (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-2xl font-semibold">First bookable session</h2>
              <input
                value={draft.sessionTitle ?? ""}
                onChange={(e) => update({ sessionTitle: e.target.value })}
                className="mt-6 w-full rounded-lg border border-slate-200 px-4 py-3"
                placeholder="Intro consultation · 45 min"
              />
              <div className="mt-4 flex gap-4">
                <input
                  type="number"
                  value={draft.eventDuration ?? ""}
                  onChange={(e) =>
                    update({ eventDuration: Number(e.target.value) })
                  }
                  className="w-32 rounded-lg border border-slate-200 px-4 py-3"
                  placeholder="Min"
                />
                <input
                  type="number"
                  value={draft.eventPrice ?? ""}
                  onChange={(e) =>
                    update({ eventPrice: Number(e.target.value) })
                  }
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-3"
                  placeholder="Price €"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto w-full max-w-lg">
              <h2 className="text-2xl font-semibold">How members see you</h2>
              <input
                value={draft.name ?? ""}
                onChange={(e) => update({ name: e.target.value })}
                className="mt-6 w-full rounded-lg border border-slate-200 px-4 py-3"
                placeholder="Dr. Ana Silva"
              />
              <textarea
                value={draft.headline ?? ""}
                onChange={(e) => update({ headline: e.target.value })}
                className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-3"
                rows={3}
                placeholder="Headline for your profile"
              />
            </div>
          )}

          {step === 3 && (
            <DraftSavedHandoff
              workspaceName={draft.workspaceName ?? "Your Expert Space"}
              summary={`${draft.specialty ?? "Specialty"} · Community Expert tier · photos and compliance in Setting up.`}
            />
          )}
        </main>

        {step < 3 && (
          <footer className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="mx-auto flex max-w-xl justify-between">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                className="text-sm text-slate-500 disabled:invisible"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

export function SetupRailLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <SetupRailContent />
    </CreateSpaceGate>
  )
}
