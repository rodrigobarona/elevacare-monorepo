"use client"

import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

export type EventPipelineStage = "session" | "profile" | "gallery" | "launch"

const STAGES: { id: EventPipelineStage; label: string }[] = [
  { id: "session", label: "Session" },
  { id: "profile", label: "Profile" },
  { id: "gallery", label: "Gallery" },
  { id: "launch", label: "Launch" },
]

interface EventPipelineBarProps {
  activeStage: EventPipelineStage
  className?: string
}

export function getEventPipelineStage(stepId: string): EventPipelineStage {
  if (
    stepId.startsWith("c-0") ||
    stepId.startsWith("c-event") ||
    stepId === "c-duration" ||
    stepId === "c-format" ||
    stepId === "c-price" ||
    stepId.startsWith("c-desc")
  ) {
    return "session"
  }
  if (
    stepId === "c-ai-bridge" ||
    stepId.startsWith("c-headline") ||
    stepId === "c-qual"
  ) {
    return "profile"
  }
  if (stepId === "c-upload") return "gallery"
  return "launch"
}

export function EventPipelineBar({
  activeStage,
  className,
}: EventPipelineBarProps) {
  const activeIndex = STAGES.findIndex((s) => s.id === activeStage)

  return (
    <div
      className={cn(
        "border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-8",
        className
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
        {STAGES.map((stage, index) => {
          const complete = index < activeIndex
          const active = stage.id === activeStage

          return (
            <div
              key={stage.id}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex w-full items-center">
                {index > 0 ? (
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      complete || active ? "bg-eleva-primary" : "bg-muted"
                    )}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    complete
                      ? "bg-eleva-primary text-primary-foreground"
                      : active
                        ? "bg-eleva-primary text-primary-foreground ring-4 ring-eleva-primary/20"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {complete ? (
                    <CheckIcon className="size-3.5" weight="bold" />
                  ) : (
                    index + 1
                  )}
                </span>
                {index < STAGES.length - 1 ? (
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      complete ? "bg-eleva-primary" : "bg-muted"
                    )}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide uppercase sm:text-xs",
                  active ? "text-eleva-primary" : "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
