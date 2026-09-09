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

const SLUG = "publish-checklist"

const CHECKS: { label: string; field: keyof LabDraft }[] = [
  { label: "Profile photos (5+)", field: "photosDone" },
  { label: "Stripe Connect", field: "stripeDone" },
  { label: "Compliance gate", field: "complianceDone" },
  { label: "Terms accepted", field: "termsAccepted" },
  { label: "First session priced", field: "sessionTitle" },
  { label: "MFA enabled (recommended)", field: "mfaEnabled" },
]

function PublishChecklistContent() {
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const done = CHECKS.filter((c) => {
    const v = draft[c.field]
    return c.field === "sessionTitle" ? Boolean(v) : Boolean(v)
  }).length
  const pct = Math.round((done / CHECKS.length) * 100)

  return (
    <SetupLabShell draft={draft} labLabel="S9 · Publish checklist">
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        <div
          className="relative flex size-32 shrink-0 items-center justify-center rounded-full border-8 border-stone-200"
          style={{ background: `conic-gradient(#059669 ${pct}%, #e7e5e4 0)` }}
        >
          <span className="flex size-24 items-center justify-center rounded-full bg-white text-2xl font-semibold">
            {pct}%
          </span>
        </div>
        <ul className="flex-1 space-y-2">
          {CHECKS.map((c) => {
            const complete =
              c.field === "sessionTitle"
                ? Boolean(draft.sessionTitle)
                : Boolean(draft[c.field])
            return (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() =>
                    c.field === "sessionTitle"
                      ? update({
                          sessionTitle:
                            draft.sessionTitle ?? "Intro consultation",
                        })
                      : update({ [c.field]: true })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm",
                    complete ? "border-emerald-200 bg-emerald-50" : "bg-white"
                  )}
                >
                  <span
                    className={cn(
                      "size-4 rounded-full border-2",
                      complete && "border-emerald-600 bg-emerald-600"
                    )}
                  />
                  {c.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {pct === 100 ? (
        <button
          type="button"
          className="mt-8 rounded-full bg-emerald-600 px-8 py-3 text-sm font-medium text-white"
        >
          Publish Space (mock)
        </button>
      ) : null}
    </SetupLabShell>
  )
}

export function PublishChecklistLab() {
  return (
    <SetupSpaceGate slug={SLUG}>
      <PublishChecklistContent />
    </SetupSpaceGate>
  )
}
