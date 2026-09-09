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

const SLUG = "path-fork"

function PathForkContent() {
  const [path, setPath] = useState<"solo" | "clinic" | null>(
    () => loadLabDraft(SLUG).path ?? null
  )
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  if (!path) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-sky-50 px-6">
        <Link
          href="/expert-onboarding"
          className="absolute top-6 left-6 text-sm text-sky-700"
        >
          ← Hub
        </Link>
        <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase">
          O6 · Time2book
        </p>
        <h1 className="mt-4 text-center text-3xl font-semibold">
          How are you joining Eleva?
        </h1>
        <div className="mt-10 grid w-full max-w-lg gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setPath("solo")
              update({ path: "solo" })
            }}
            className="rounded-2xl border-2 border-sky-200 bg-white p-8 text-left hover:border-sky-500"
          >
            <h2 className="text-xl font-semibold">Solo expert</h2>
            <p className="mt-2 text-sm text-stone-500">
              Independent practice, your own Space
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setPath("clinic")
              update({ path: "clinic" })
            }}
            className="rounded-2xl border-2 border-orange-200 bg-white p-8 text-left hover:border-orange-500"
          >
            <h2 className="text-xl font-semibold">Clinic team</h2>
            <p className="mt-2 text-sm text-stone-500">
              Join or create a Team Space
            </p>
          </button>
        </div>
      </div>
    )
  }

  const soloSteps = ["Specialty", "Session", "Profile", "Done"]
  const clinicSteps = ["Clinic name", "Invite code", "Your role", "Done"]
  const labels = path === "solo" ? soloSteps : clinicSteps

  return (
    <div
      className={cn(
        "min-h-screen px-6 py-12",
        path === "solo" ? "bg-sky-50" : "bg-orange-50"
      )}
    >
      <Link href="/expert-onboarding" className="text-sm text-stone-600">
        ← Hub
      </Link>
      <p className="mt-6 text-xs tracking-widest uppercase">
        {path === "solo" ? "Solo path" : "Clinic path"}
      </p>
      <div className="mt-4 flex gap-2">
        {labels.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= step ? "bg-stone-800" : "bg-stone-300"
            )}
          />
        ))}
      </div>

      <main className="mx-auto mt-12 max-w-md">
        {path === "solo" && step === 0 && (
          <input
            value={draft.specialty ?? ""}
            onChange={(e) => update({ specialty: e.target.value })}
            placeholder="Your specialty"
            className="w-full rounded-xl border bg-white px-4 py-4 text-lg"
          />
        )}
        {path === "solo" && step === 1 && (
          <input
            value={draft.sessionTitle ?? ""}
            onChange={(e) => update({ sessionTitle: e.target.value })}
            placeholder="First session title"
            className="w-full rounded-xl border bg-white px-4 py-4 text-lg"
          />
        )}
        {path === "solo" && step === 2 && (
          <input
            value={draft.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Your name"
            className="w-full rounded-xl border bg-white px-4 py-4 text-lg"
          />
        )}
        {path === "clinic" && step === 0 && (
          <input
            value={draft.workspaceName ?? ""}
            onChange={(e) => update({ workspaceName: e.target.value })}
            placeholder="Clinic / team name"
            className="w-full rounded-xl border bg-white px-4 py-4 text-lg"
          />
        )}
        {path === "clinic" && step === 1 && (
          <input
            placeholder="Invite code (optional)"
            className="w-full rounded-xl border bg-white px-4 py-4 text-lg"
          />
        )}
        {path === "clinic" && step === 2 && (
          <select className="w-full rounded-xl border bg-white px-4 py-4 text-lg">
            <option>Practitioner</option>
            <option>Admin</option>
          </select>
        )}
        {step === 3 && (
          <DraftSavedHandoff
            workspaceName={draft.workspaceName}
            summary={
              path === "solo"
                ? "Solo Expert Space draft saved."
                : "Team Space draft saved."
            }
          />
        )}
      </main>

      {step < 3 && (
        <footer className="mx-auto mt-10 flex max-w-md justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? setPath(null) : setStep((s) => s - 1))}
            className="text-sm text-stone-500"
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
      )}
    </div>
  )
}

export function PathForkLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <PathForkContent />
    </CreateSpaceGate>
  )
}
