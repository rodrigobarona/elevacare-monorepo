"use client"

import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

interface WizardFooterProps {
  onBack: () => void
  onNext: () => void
  canNext: boolean
  nextLabel?: string
  showBack?: boolean
  optional?: boolean
  onSkip?: () => void
  progressLabel?: string
  progress?: number
  isChapterCover?: boolean
  className?: string
}

export function WizardFooter({
  onBack,
  onNext,
  canNext,
  nextLabel = "Continue",
  showBack = true,
  optional,
  onSkip,
  progressLabel,
  progress,
  isChapterCover = false,
  className,
}: WizardFooterProps) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm",
        isChapterCover && "border-stone-200/80 bg-stone-50/95",
        className
      )}
    >
      {typeof progress === "number" ? (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-eleva-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="min-w-[6rem]">
          {showBack ? (
            <Button type="button" variant="ghost" size="lg" onClick={onBack}>
              Back
            </Button>
          ) : null}
        </div>
        {progressLabel ? (
          <p className="hidden text-center text-base font-medium text-muted-foreground sm:block">
            {progressLabel}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          {optional && onSkip ? (
            <Button type="button" variant="ghost" size="lg" onClick={onSkip}>
              Skip
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            className={cn("min-w-[8rem]", isChapterCover && "px-8")}
            onClick={onNext}
            disabled={!canNext}
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </footer>
  )
}
