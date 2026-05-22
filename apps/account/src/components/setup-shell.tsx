import Link from "next/link"
import { ArrowLeftIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

interface SetupShellProps {
  backHref: string
  step: number
  totalSteps: number
  title: string
  description?: string
  children: React.ReactNode
}

export function SetupShell({
  backHref,
  step,
  totalSteps,
  title,
  description,
  children,
}: SetupShellProps) {
  const progress = Math.min(100, Math.round((step / totalSteps) * 100))

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Link>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className={cn("space-y-2")}>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </main>
  )
}
