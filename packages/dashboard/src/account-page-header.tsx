import type { ReactNode } from "react"

import { cn } from "@eleva/ui/lib/utils"

interface AccountPageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function AccountPageHeader({
  title,
  description,
  actions,
  className,
}: AccountPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8",
        actions
          ? "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          : "space-y-2",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="font-serif text-3xl tracking-tight text-eleva-primary">
          {title}
        </h1>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  )
}
