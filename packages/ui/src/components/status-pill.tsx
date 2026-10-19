import type { ReactNode } from "react"
import { cn } from "@eleva/ui/lib/utils"

export type StatusTone = "positive" | "attention" | "neutral"

function toneClass(tone: StatusTone): string {
  switch (tone) {
    case "positive":
      return "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
    case "attention":
      return "bg-coral-50 text-coral-800 dark:bg-coral-950 dark:text-coral-200"
    case "neutral":
      return "bg-muted text-muted-foreground"
    default: {
      const unreachable: never = tone
      return unreachable
    }
  }
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClass(tone),
        className
      )}
    >
      {children}
    </span>
  )
}
