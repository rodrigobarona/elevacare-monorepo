"use client"

import { CalendarIcon, ClockIcon, MapPinIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import {
  COUNTRY_LABELS,
  type ExpertDraft,
} from "@/domains/expert-onboarding/lib/types"

interface SessionCardPreviewProps {
  draft: ExpertDraft
  compact?: boolean
  className?: string
}

/** Inline bookable session card — PoC C event-first */
export function SessionCardPreview({
  draft,
  compact,
  className,
}: SessionCardPreviewProps) {
  const title =
    draft.eventTitle.en ||
    draft.eventTitle.pt ||
    draft.eventTitle.es ||
    "Your first session"
  const description =
    draft.eventDescription.en ||
    draft.eventDescription.pt ||
    draft.eventDescription.es ||
    "Describe what members can expect in this session."

  return (
    <div
      className={cn(
        "rounded-2xl border border-eleva-primary/25 bg-gradient-to-br from-eleva-primary/5 to-background p-5 shadow-sm",
        compact && "p-4",
        className
      )}
    >
      <p className="text-xs font-semibold tracking-wider text-eleva-primary uppercase">
        Bookable session
      </p>
      <p
        className={cn(
          "mt-2 font-semibold text-foreground",
          compact ? "text-base" : "text-lg"
        )}
      >
        {title}
      </p>
      {!compact && description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="size-4" weight="duotone" />
          {draft.eventDuration || 50} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarIcon className="size-4" weight="duotone" />
          {draft.sessionMode
            ? draft.sessionMode.replace("_", " ")
            : "Format TBD"}
        </span>
        {draft.eventPrice > 0 ? (
          <span className="font-medium text-foreground">
            €{draft.eventPrice}
          </span>
        ) : null}
        {draft.city ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4" weight="duotone" />
            {draft.city} · {COUNTRY_LABELS[draft.practiceCountry]}
          </span>
        ) : null}
      </div>
    </div>
  )
}
