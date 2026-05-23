"use client"

import { cn } from "@eleva/ui/lib/utils"
import type { StepNavigationContext } from "@/lib/wizard-navigation"

interface ChapterContextBarProps {
  nav: StepNavigationContext
  className?: string
}

export function ChapterContextBar({ nav, className }: ChapterContextBarProps) {
  if (nav.isChapterCover || nav.phase === "flow") return null

  const segments = nav.questionTotal ?? 0
  const filled = nav.questionIndex ?? 0

  return (
    <div
      className={cn(
        "shrink-0 border-b border-border/50 bg-background/90 px-6 py-4 backdrop-blur-sm sm:px-10 lg:px-12",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {nav.chapterName ? (
              <p className="text-sm font-semibold tracking-wider text-eleva-primary uppercase">
                {nav.chapterIndex != null
                  ? `Chapter ${nav.chapterIndex} · ${nav.chapterName}`
                  : nav.chapterName}
              </p>
            ) : (
              <p className="text-sm font-semibold tracking-wider text-eleva-primary uppercase">
                Getting started
              </p>
            )}
            <p className="mt-0.5 text-lg font-medium text-foreground">
              {nav.progressLabel}
            </p>
          </div>
        </div>
        {segments > 1 ? (
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuenow={filled}
            aria-valuemax={segments}
          >
            {Array.from({ length: segments }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < filled ? "bg-eleva-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
