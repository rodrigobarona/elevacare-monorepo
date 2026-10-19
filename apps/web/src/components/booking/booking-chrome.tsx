import type { ReactNode } from "react"
import { cn } from "@eleva/ui/lib/utils"

export function FunnelStepper({
  label,
  total,
  current,
}: {
  label: string
  total: number
  /** Zero-based index of the active step. */
  current: number
}) {
  return (
    <div>
      <p className="eyebrow text-primary">{label}</p>
      <ol className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              index <= current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </ol>
    </div>
  )
}

export function StepHeader({
  title,
  sub,
  testId,
  children,
}: {
  title: string
  sub: string
  testId?: string
  children?: ReactNode
}) {
  return (
    <header className="space-y-2">
      <h1
        data-testid={testId}
        className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h1>
      <p className="text-muted-foreground">{sub}</p>
      {children}
    </header>
  )
}

export function FormCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-5 rounded-4xl bg-card p-6 shadow-1 ring-1 ring-foreground/5">
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden className="font-display text-lg font-medium">
        {title}
      </h2>
      {children}
    </fieldset>
  )
}
