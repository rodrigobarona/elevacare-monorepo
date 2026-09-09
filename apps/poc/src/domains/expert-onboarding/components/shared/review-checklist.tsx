"use client"

import { CheckCircleIcon, CircleIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

export interface ReviewItem {
  id: string
  label: string
  done: boolean
}

interface ReviewChecklistProps {
  items: ReviewItem[]
  className?: string
  dark?: boolean
}

export function ReviewChecklist({
  items,
  className,
  dark,
}: ReviewChecklistProps) {
  return (
    <ul
      className={cn(
        "space-y-3",
        dark && "rounded-2xl bg-stone-950 p-6 text-stone-100",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-sm">
          {item.done ? (
            <CheckCircleIcon
              className={cn(
                "size-5 shrink-0",
                dark ? "text-emerald-400" : "text-emerald-600"
              )}
              weight="fill"
            />
          ) : (
            <CircleIcon
              className={cn(
                "size-5 shrink-0",
                dark ? "text-stone-500" : "text-muted-foreground"
              )}
            />
          )}
          <span
            className={
              item.done ? "" : dark ? "text-stone-400" : "text-muted-foreground"
            }
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  )
}
