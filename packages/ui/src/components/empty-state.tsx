import type { ReactNode } from "react"

import { cn } from "@eleva/ui/lib/utils"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eleva/ui/components/empty"

type EmptyStateVariant = "first-run" | "no-results" | "error"

const VARIANT_CLASS: Record<EmptyStateVariant, string> = {
  "first-run": "border border-dashed bg-card",
  "no-results": "border bg-muted/40",
  error: "border border-destructive/30 bg-destructive-subtle",
}

const MEDIA_CLASS: Record<EmptyStateVariant, string> = {
  "first-run": "bg-primary/10 text-primary",
  "no-results": "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
}

interface EmptyStateProps {
  /**
   * `first-run`: nothing created yet (invite the first action).
   * `no-results`: filters/search returned nothing.
   * `error`: data failed to load; announced to assistive tech.
   */
  variant?: EmptyStateVariant
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  variant = "first-run",
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Empty
      role={variant === "error" ? "alert" : "status"}
      data-variant={variant}
      className={cn("p-8 md:p-12", VARIANT_CLASS[variant], className)}
    >
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon" className={MEDIA_CLASS[variant]}>
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
