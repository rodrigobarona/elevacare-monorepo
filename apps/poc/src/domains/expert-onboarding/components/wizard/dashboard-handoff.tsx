"use client"

import { CheckCircleIcon, CircleIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

interface DashboardHandoffProps {
  draft: ExpertDraft
  onCompleteProfile?: () => void
  complianceInline?: boolean
}

export function DashboardHandoff({
  draft,
  onCompleteProfile,
  complianceInline = false,
}: DashboardHandoffProps) {
  const items = [
    {
      id: "event",
      label: "First bookable session",
      done: !!draft.eventTitle.en,
    },
    {
      id: "photos",
      label: "Profile photos (5+)",
      done: draft.photos.length >= 5,
    },
    { id: "headline", label: "Public headline", done: !!draft.headline.en },
    {
      id: "qual",
      label: "Qualifications",
      done: draft.qualifications.en.length >= 150,
    },
    {
      id: "compliance",
      label: "Trust & compliance",
      done: complianceInline && !!draft.nif,
    },
    { id: "publish", label: "Request to go live", done: false },
  ]

  const doneCount = items.filter((i) => i.done).length
  const pct = Math.round((doneCount / items.length) * 100)

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium text-muted-foreground">
        Your dashboard
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {draft.workspaceName || "Expert workspace"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        You&apos;re {pct}% ready. Finish these tasks to publish.
      </p>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-eleva-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3"
          >
            {item.done ? (
              <CheckCircleIcon
                className="size-5 text-emerald-600"
                weight="fill"
              />
            ) : (
              <CircleIcon className="size-5 text-muted-foreground" />
            )}
            <span
              className={cn("text-sm", !item.done && "text-muted-foreground")}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      {onCompleteProfile ? (
        <Button className="mt-8" onClick={onCompleteProfile}>
          Continue setup
        </Button>
      ) : null}
    </div>
  )
}
