"use client"

import { SealCheckIcon, SparkleIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

interface CommunityExpertBadgeProps {
  className?: string
  showTopHint?: boolean
}

export function CommunityExpertBadge({
  className,
  showTopHint = true,
}: CommunityExpertBadgeProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="inline-flex items-center gap-2 rounded-full border border-eleva-primary/20 bg-eleva-primary/5 px-3 py-1.5 text-sm font-medium text-eleva-primary">
        <SealCheckIcon className="size-4" weight="duotone" />
        Community Expert
      </div>
      {showTopHint ? (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;re starting as a{" "}
            <span className="font-medium text-foreground">
              Community Expert
            </span>
            . Top Expert is earned through member ratings, completed sessions,
            and consistent availability — never purchased.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <SparkleIcon className="size-3.5 text-amber-500" weight="fill" />
            Featured placement unlocks with Top Expert status
          </div>
        </div>
      ) : null}
    </div>
  )
}
