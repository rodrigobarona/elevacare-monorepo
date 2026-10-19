import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

export type StepItem = {
  title: React.ReactNode
  description: React.ReactNode
}

/** Numbered "how it works" list; numbers are decorative, order is the list. */
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
        <li key={index} className="flex flex-col gap-3 border-t pt-6">
          <span
            aria-hidden
            className="font-display text-headline leading-none text-primary italic"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-xl font-medium tracking-tight">{item.title}</h3>
          <p className="text-pretty text-muted-foreground">
            {item.description}
          </p>
        </li>
      ))}
    </ol>
  )
}

export { Steps }
