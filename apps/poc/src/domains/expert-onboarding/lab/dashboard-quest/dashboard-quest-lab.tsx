"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { cn } from "@eleva/ui/lib/utils"
import { SetupSpaceGate } from "@/domains/expert-onboarding/lab/shared/setup-space-gate"
import { SetupLabShell } from "@/domains/expert-onboarding/lab/shared/setup-lab-shell"
import {
  loadLabDraft,
  patchLabDraft,
  type LabDraft,
} from "@/domains/expert-onboarding/lab/shared/mock-storage"

const SLUG = "dashboard-quest"

const SETUP_TASKS = [
  { id: "photos", label: "Add 5 profile photos", field: "photosDone" as const },
  {
    id: "stripe",
    label: "Connect Stripe payouts",
    field: "stripeDone" as const,
  },
  {
    id: "compliance",
    label: "Complete compliance gate",
    field: "complianceDone" as const,
  },
  {
    id: "mfa",
    label: "Enable two-factor auth (recommended)",
    field: "mfaEnabled" as const,
  },
]

function DashboardQuestContent() {
  const [overlayOpen, setOverlayOpen] = useState(true)
  const [questStep, setQuestStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const task = SETUP_TASKS[questStep]

  return (
    <SetupLabShell draft={draft} labLabel="S2 · Dashboard quest">
      <div className="relative min-h-[70vh] rounded-2xl bg-stone-200">
        <div
          className={cn("min-h-[70vh] transition", overlayOpen && "blur-sm")}
        >
          <div className="flex">
            <aside className="hidden w-52 border-r border-stone-300 bg-stone-100 p-4 md:block">
              {["Overview", "Sessions", "Members", "Settings"].map(
                (item, i) => (
                  <p
                    key={item}
                    className={cn(
                      "rounded px-3 py-2 text-sm",
                      i === 0 && "bg-white font-medium shadow-sm"
                    )}
                  >
                    {item}
                  </p>
                )
              )}
            </aside>
            <main className="flex-1 p-8">
              <div className="grid gap-4 md:grid-cols-3">
                {["1 session", "0 members", "Draft profile"].map((stat) => (
                  <div key={stat} className="rounded-xl bg-white p-6 shadow-sm">
                    <p className="text-2xl font-semibold">—</p>
                    <p className="text-sm text-stone-500">{stat}</p>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>

        {overlayOpen && task && (
          <div className="absolute inset-x-0 bottom-0 z-10 md:inset-x-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="rounded-t-3xl bg-white p-8 shadow-2xl md:rounded-3xl">
              <p className="text-xs font-semibold tracking-widest text-stone-400 uppercase">
                Setup quest · {questStep + 1} of {SETUP_TASKS.length}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{task.label}</h2>
              <p className="mt-2 text-sm text-stone-500">
                Mock completion for this prototype.
              </p>
              <button
                type="button"
                onClick={() => update({ [task.field]: true })}
                className="mt-6 w-full rounded-xl border-2 border-dashed border-stone-300 py-8 text-sm text-stone-500 hover:border-stone-900"
              >
                Mark complete (mock)
              </button>
              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (questStep === 0) setOverlayOpen(false)
                    else setQuestStep((s) => s - 1)
                  }}
                  className="text-sm text-stone-500"
                >
                  {questStep === 0 ? "Skip for now" : "Back"}
                </button>
                <button
                  type="button"
                  disabled={!draft[task.field]}
                  onClick={() => {
                    if (questStep < SETUP_TASKS.length - 1)
                      setQuestStep((s) => s + 1)
                    else setOverlayOpen(false)
                  }}
                  className="rounded-full bg-stone-900 px-6 py-2 text-sm text-white disabled:opacity-40"
                >
                  {questStep === SETUP_TASKS.length - 1
                    ? "Enter dashboard"
                    : "Continue"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!overlayOpen && (
          <div className="p-8">
            <h2 className="text-xl font-semibold">Ready to publish</h2>
            <p className="mt-2 text-stone-600">
              All setup tasks marked complete in this demo.
            </p>
            <Link
              href="/expert-onboarding#setting-up"
              className="mt-4 inline-block text-sm underline"
            >
              Explore more setup patterns
            </Link>
            <button
              type="button"
              onClick={() => setOverlayOpen(true)}
              className="fixed right-6 bottom-6 rounded-full bg-stone-900 px-5 py-3 text-sm text-white shadow-lg"
            >
              Resume setup quest
            </button>
          </div>
        )}
      </div>
    </SetupLabShell>
  )
}

export function DashboardQuestLab() {
  return (
    <SetupSpaceGate slug={SLUG}>
      <DashboardQuestContent />
    </SetupSpaceGate>
  )
}
