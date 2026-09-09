"use client"

import { cn } from "@eleva/ui/lib/utils"

interface PromptFrameProps {
  title: string
  helper?: string
  children: React.ReactNode
  className?: string
}

/** Full-viewport centered question layout — PoC D guided prompts */
export function PromptFrame({
  title,
  helper,
  children,
  className,
}: PromptFrameProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12 sm:px-10",
        className
      )}
    >
      <div className="w-full max-w-xl">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl sm:leading-tight">
          {title}
        </h1>
        {helper ? (
          <p className="mt-4 text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
            {helper}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </div>
  )
}
