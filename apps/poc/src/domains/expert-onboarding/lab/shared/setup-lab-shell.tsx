"use client"

import Link from "next/link"
import type { LabDraft } from "@/domains/expert-onboarding/lab/shared/mock-storage"

interface SetupLabShellProps {
  draft: LabDraft
  labLabel: string
  children: React.ReactNode
}

export function SetupLabShell({
  draft,
  labLabel,
  children,
}: SetupLabShellProps) {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <Link
              href="/expert-onboarding"
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              ← Hub
            </Link>
            <p className="text-sm font-semibold">
              {draft.workspaceName ?? "Expert Space"}
            </p>
          </div>
          <span className="text-xs tracking-widest text-amber-700 uppercase">
            {labLabel}
          </span>
        </div>
      </header>
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-sm text-amber-900">
        Setup incomplete — finish tasks below to publish for members
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
