import type { ReactNode } from "react"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Short facts on one line, separated by a middle dot. Each fact carries
 * its dot in front, and the dot that would lead a line is clipped, so a
 * line that wraps on a phone never starts or ends with a dot.
 */
export function MetaLine({
  items,
  id,
  className,
}: {
  items: ReactNode[]
  id?: string
  className?: string
}) {
  return (
    <p id={id} className={cn("overflow-hidden", className)}>
      <span className="-ml-[1.25em] flex flex-wrap">
        {items.map((item, index) => (
          <span key={index}>
            <span aria-hidden className="inline-block w-[1.25em] text-center">
              ·
            </span>
            {item}
          </span>
        ))}
      </span>
    </p>
  )
}
