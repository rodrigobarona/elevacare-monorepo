import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

export type StepItem = {
  title: React.ReactNode
  description: React.ReactNode
}

/**
 * Numbered "how it works" list, for things that really happen in order. The
 * numbers are quiet and decorative; the order is the list.
 */
function Steps({
  items,
  className,
}: {
  items: readonly StepItem[]
  className?: string
}) {
  return (
    <ol
      data-slot="steps"
      className={cn("grid gap-8 sm:grid-cols-3 sm:gap-6", className)}
    >
      {items.map((item, index) => (
        <li key={index} className="flex flex-col gap-2 border-t pt-5">
          <span
            aria-hidden
            className="font-display text-2xl leading-none text-muted-foreground"
          >
            {index + 1}
          </span>
          <h3 className="font-display text-2xl tracking-tight">{item.title}</h3>
          <p className="text-lg text-pretty text-muted-foreground">
            {item.description}
          </p>
        </li>
      ))}
    </ol>
  )
}

export { Steps }
