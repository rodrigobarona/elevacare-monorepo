"use client"

import Link from "next/link"

interface DraftSavedHandoffProps {
  workspaceName?: string
  summary?: string
}

export function DraftSavedHandoff({
  workspaceName,
  summary,
}: DraftSavedHandoffProps) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border/60 bg-background p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-widest text-eleva-primary uppercase">
        Draft saved
      </p>
      <h2 className="mt-3 text-2xl font-semibold">
        {workspaceName
          ? `${workspaceName} is ready for setup`
          : "Your Expert Space draft is saved"}
      </h2>
      <p className="mt-3 text-muted-foreground">
        {summary ??
          "Community Expert tier · compliance and payouts happen in Setting up, not here."}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/expert-onboarding#setting-up"
          className="rounded-full bg-stone-900 px-6 py-3 text-center text-sm font-medium text-white"
        >
          Explore setting up gallery
        </Link>
        <Link
          href="/expert-onboarding"
          className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium"
        >
          Back to hub
        </Link>
      </div>
    </div>
  )
}
