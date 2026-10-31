import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

export type TrustItem = {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
}

/**
 * Row of reassurance points in one panel split by hairlines. Pass duotone
 * icons: they sit white on a solid teal tile. The `bar` variant is a single
 * slim line of icon and title, for use right under a hero.
 */
function TrustStrip({
  items,
  variant = "panel",
  className,
}: {
  items: readonly TrustItem[]
  variant?: "panel" | "bar"
  className?: string
}) {
  if (variant === "bar") {
    return (
      <ul
        data-slot="trust-strip"
        className={cn(
          "grid grid-cols-2 gap-x-6 gap-y-3 lg:flex lg:items-center lg:justify-between",
          className
        )}
      >
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-center gap-2.5 text-sm font-medium text-foreground [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-primary"
          >
            {item.icon}
            {item.title}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul
      data-slot="trust-strip"
      className={cn(
        "grid gap-px overflow-hidden rounded-3xl bg-border/70 ring-1 ring-border/70 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className="flex flex-col gap-5 bg-background p-6 sm:p-7"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-1 ring-4 ring-teal-50 dark:bg-teal-600 dark:ring-teal-950 [&_svg]:size-6">
            {item.icon}
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-medium text-foreground">
              {item.title}
            </p>
            {item.description ? (
              <p className="text-sm text-pretty text-muted-foreground">
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
