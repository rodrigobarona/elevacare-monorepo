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

const SLUG = "studio-canvas"
const ACCENTS = ["#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"]

function StudioCanvasContent() {
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<LabDraft>(() => ({
    accentColor: ACCENTS[0],
    ...loadLabDraft(SLUG),
  }))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const accent = draft.accentColor ?? ACCENTS[0]

  if (saved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f12] px-6">
        <DraftSavedHandoff
          workspaceName={draft.workspaceName ?? "Your Space"}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f12] text-white">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          href="/expert-onboarding"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Hub
        </Link>
        <span className="text-xs tracking-widest text-violet-400 uppercase">
          O5 · Clay
        </span>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col items-center px-6 py-8 md:flex-row md:gap-16">
        <div className="w-full md:w-1/2">
          <h1 className="text-3xl font-semibold">Design your Expert Space</h1>
          <p className="mt-3 text-zinc-400">
            This is how members will recognize you — not a form, a canvas.
          </p>

          <label className="mt-8 block text-xs font-medium text-zinc-500 uppercase">
            Space name
          </label>
          <input
            value={draft.workspaceName ?? ""}
            onChange={(e) => update({ workspaceName: e.target.value })}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-lg outline-none focus:border-violet-500"
            placeholder="Ana's Studio"
          />

          <label className="mt-6 block text-xs font-medium text-zinc-500 uppercase">
            Accent
          </label>
          <div className="mt-2 flex gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ accentColor: c })}
                className={cn(
                  "size-10 rounded-full transition-transform hover:scale-110",
                  accent === c &&
                    "ring-2 ring-white ring-offset-2 ring-offset-[#0f0f12]"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Accent ${c}`}
              />
            ))}
          </div>

          <label className="mt-6 block text-xs font-medium text-zinc-500 uppercase">
            Specialty tag
          </label>
          <input
            value={draft.specialty ?? ""}
            onChange={(e) => update({ specialty: e.target.value })}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 outline-none"
            placeholder="Movement therapy"
          />

          <button
            type="button"
            onClick={() => setSaved(true)}
            className="mt-10 w-full rounded-full py-3.5 font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Save draft
          </button>
        </div>

        <div className="mt-12 w-full md:mt-0 md:w-1/2">
          <div
            className="relative overflow-hidden rounded-3xl border border-zinc-800 p-8 shadow-2xl transition-all duration-500 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(145deg, ${accent}22, #18181b)`,
            }}
          >
            <div
              className="mb-6 flex size-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              {(draft.workspaceName ?? "A").charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-semibold">
              {draft.workspaceName || "Your Space"}
            </h2>
            <p className="mt-2 text-zinc-400">
              {draft.specialty || "Specialty tag"}
            </p>
            <span
              className="mt-8 inline-block rounded-full px-3 py-1 text-xs"
              style={{ backgroundColor: `${accent}44`, color: accent }}
            >
              Community Expert
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}

export function StudioCanvasLab() {
  return (
    <CreateSpaceGate slug={SLUG}>
      <StudioCanvasContent />
    </CreateSpaceGate>
  )
}
