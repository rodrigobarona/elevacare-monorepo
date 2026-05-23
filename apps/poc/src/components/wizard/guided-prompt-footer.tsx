"use client"

import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

interface GuidedPromptFooterProps {
  onBack: () => void
  onNext: () => void
  canNext: boolean
  nextLabel?: string
  showBack?: boolean
  optional?: boolean
  onSkip?: () => void
  stepIndex: number
  stepTotal: number
  className?: string
}

/** PoC D — bottom-centered dots + single primary action */
export function GuidedPromptFooter({
  onBack,
  onNext,
  canNext,
  nextLabel = "Continue",
  showBack = true,
  optional,
  onSkip,
  stepIndex,
  stepTotal,
  className,
}: GuidedPromptFooterProps) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/40 bg-background/95 px-4 py-6 backdrop-blur-sm sm:px-8",
        className
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
        <div className="flex items-center gap-2">
          {Array.from({ length: stepTotal }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-2 rounded-full transition-colors",
                i <= stepIndex ? "bg-eleva-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Question {stepIndex + 1} of {stepTotal}
        </p>
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-[5rem]">
            {showBack ? (
              <Button type="button" variant="ghost" onClick={onBack}>
                Back
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {optional && onSkip ? (
              <Button type="button" variant="ghost" onClick={onSkip}>
                Skip
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="min-w-[10rem]"
              onClick={onNext}
              disabled={!canNext}
            >
              {nextLabel}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
