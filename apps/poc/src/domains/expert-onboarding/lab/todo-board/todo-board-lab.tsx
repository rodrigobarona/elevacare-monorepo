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

const SLUG = "todo-board"

type Col = "required" | "recommended" | "done"

const ITEMS: { id: string; label: string; col: Col; field?: keyof LabDraft }[] =
  [
    {
      id: "photos",
      label: "Upload 5 photos",
      col: "required",
      field: "photosDone",
    },
    {
      id: "stripe",
      label: "Connect Stripe",
      col: "required",
      field: "stripeDone",
    },
    {
      id: "compliance",
      label: "Compliance gate",
      col: "required",
      field: "complianceDone",
    },
    { id: "mfa", label: "Enable MFA", col: "recommended", field: "mfaEnabled" },
    {
      id: "terms",
      label: "Accept terms",
      col: "recommended",
      field: "termsAccepted",
    },
  ]

function TodoBoardContent() {
  const [draft, setDraft] = useState<LabDraft>(() => loadLabDraft(SLUG))

  const update = useCallback((patch: Partial<LabDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      patchLabDraft(SLUG, next)
      return next
    })
  }, [])

  const column = (col: Col) =>
    ITEMS.filter((item) => {
      if (item.field && draft[item.field]) return col === "done"
      return item.col === col
    })

  return (
    <SetupLabShell draft={draft} labLabel="S4 · Todo board">
      <div className="grid gap-4 md:grid-cols-3">
        {(["required", "recommended", "done"] as Col[]).map((col) => (
          <div key={col} className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold tracking-widest text-stone-500 uppercase">
              {col}
            </h3>
            <ul className="mt-4 space-y-2">
              {column(col).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => item.field && update({ [item.field]: true })}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left text-sm",
                      col === "done"
                        ? "border-emerald-200 bg-emerald-50"
                        : "hover:border-stone-400"
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SetupLabShell>
  )
}

export function TodoBoardLab() {
  return (
    <SetupSpaceGate slug={SLUG}>
      <TodoBoardContent />
    </SetupSpaceGate>
  )
}
