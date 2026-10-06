import type { ReactNode } from "react"

import { cn } from "@eleva/ui/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  /** Short uppercase label above the title (e.g. section or org name). */
  eyebrow?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
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
        {eyebrow ? (
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl tracking-tight text-primary">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

interface SectionProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** Titled content block inside a page; use one `<h2>` level per section. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

interface StatProps {
  label: string
  value: ReactNode
  /** Secondary line, e.g. a period or comparison ("vs last month"). */
  hint?: string
  className?: string
}

export function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 text-card-foreground shadow-1",
        className
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </dd>
      {hint ? (
        <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>
      ) : null}
    </div>
  )
}

/** Responsive `<dl>` grid for `Stat` items. */
export function StatGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <dl className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </dl>
  )
}
