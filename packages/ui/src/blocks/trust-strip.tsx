import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

export type TrustItem = {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
}

/** Short row of reassurance points shown right under a hero. */
function TrustStrip({
  items,
  className,
}: {
  items: readonly TrustItem[]
  className?: string
}) {
  return (
    <ul
      data-slot="trust-strip"
      className={cn(
        "grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8",
        className
      )}
    >
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-5">
            {item.icon}
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="font-medium">{item.title}</p>
            {item.description ? (
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export { TrustStrip }
