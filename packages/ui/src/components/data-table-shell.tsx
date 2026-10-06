import type { ReactNode } from "react"

import { cn } from "@eleva/ui/lib/utils"

interface DataTableShellProps {
  title?: string
  description?: string
  /** Filters, search and bulk actions rendered above the table. */
  toolbar?: ReactNode
  /** Pagination or totals rendered below the table. */
  footer?: ReactNode
  /** A `Table` from `@eleva/ui/components/table`, or an `EmptyState`. */
  children: ReactNode
  className?: string
}

/** Card frame for tabular data: header, toolbar, scrollable body, footer. */
export function DataTableShell({
  title,
  description,
  toolbar,
  footer,
  children,
  className,
}: DataTableShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-1",
        className
      )}
    >
      {title || toolbar ? (
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          {title ? (
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t p-4 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
