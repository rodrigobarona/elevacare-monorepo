import Link from "next/link"
import { ArrowLeftIcon } from "@eleva/icons"
import { Progress } from "@eleva/ui/components/progress"
import { cn } from "@eleva/ui/lib/utils"

interface SetupShellProps {
  backHref: string
  backLabel?: string
  step: number
  totalSteps: number
  title: string
  description?: string
  stepCaption?: string
  progressAriaLabel?: string
  children: React.ReactNode
}

export function SetupShell({
  backHref,
  backLabel = "Back",
  step,
  totalSteps,
  title,
  description,
  stepCaption,
  progressAriaLabel,
  children,
}: SetupShellProps) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            {backLabel}
          </Link>
        </div>
        <div className="px-4 pb-3 sm:px-6">
          <Progress
            value={step}
            minValue={0}
            maxValue={totalSteps}
            aria-label={progressAriaLabel ?? `Step ${step} of ${totalSteps}`}
            className="mx-auto max-w-3xl"
          />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className={cn("space-y-2")}>
          {stepCaption ? (
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {stepCaption}
            </p>
          ) : null}
          <h1 className="font-display text-3xl leading-tight font-normal tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="text-base leading-7 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  )
}
