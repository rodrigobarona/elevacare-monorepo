"use client"

import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

type SetupProgressNavProps = {
  steps: string[]
  completedSteps: string[]
  activeStep: string
  onSelectStep: (step: string) => void
  stepLabel: (step: string) => string
  ariaLabel: string
  stepAriaLabel: (input: {
    step: string
    index: number
    done: boolean
    label: string
  }) => string
}

export function SetupProgressNav({
  steps,
  completedSteps,
  activeStep,
  onSelectStep,
  stepLabel,
  ariaLabel,
  stepAriaLabel,
}: SetupProgressNavProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {steps.map((step, i) => {
          const done = completedSteps.includes(step)
          const isActive = step === activeStep
          const label = stepLabel(step)
          return (
            <li key={step} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelectStep(step)}
                aria-label={stepAriaLabel({
                  step,
                  index: i,
                  done,
                  label,
                })}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-border bg-card font-medium text-foreground shadow-1"
                    : "text-muted-foreground hover:border-border/60 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 transition-colors",
                    done
                      ? "bg-primary text-primary-foreground ring-primary"
                      : isActive
                        ? "bg-background text-primary ring-2 ring-primary"
                        : "bg-background ring-border"
                  )}
                >
                  {done ? (
                    <CheckIcon weight="bold" className="size-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden whitespace-nowrap sm:inline lg:whitespace-normal">
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
