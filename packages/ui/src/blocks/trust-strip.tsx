import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

export type TrustItem = {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
}

/**
 * Reassurance points as a ruled list: an icon in ink, a statement, a line.
 * No tiles and no cards. The `bar` variant is a single slim line of icon and
 * title, for use right under a hero.
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
      className={cn("grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4", className)}
    >
      {items.map((item, index) => (
        <li key={index} className="flex flex-col gap-3 border-t py-6">
          <span className="text-foreground [&_svg]:size-7">{item.icon}</span>
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-2xl tracking-tight text-foreground">
              {item.title}
            </p>
            {item.description ? (
              <p className="text-lg text-pretty text-muted-foreground">
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
