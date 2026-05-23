"use client"

import Image from "next/image"
import { cn } from "@eleva/ui/lib/utils"
import { PromptFrame } from "@/components/wizard/prompt-frame"
import { useWizardLayout } from "@/components/wizard/wizard-layout-context"
import { SessionCardPreview } from "@/domains/expert-onboarding/components/wizard/session-card-preview"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

interface StepFrameProps {
  title: string
  helper?: string
  illustration?: string
  localeBadge?: string
  children: React.ReactNode
  className?: string
  centered?: boolean
  showSessionCard?: boolean
  draft?: ExpertDraft
}

export function StepFrame({
  title,
  helper,
  illustration,
  localeBadge,
  children,
  className,
  centered = false,
  showSessionCard: showSessionCardProp,
  draft: draftProp,
}: StepFrameProps) {
  const {
    variant,
    draft: contextDraft,
    showSessionCard: contextSessionCard,
  } = useWizardLayout()
  const draft = draftProp ?? contextDraft
  const showSessionCard = showSessionCardProp ?? contextSessionCard
  const isPrompt = variant === "dots"
  const isEventFirst = variant === "event-first"
  const isSplit = variant === "split"

  if (isPrompt) {
    return (
      <PromptFrame title={title} helper={helper} className={className}>
        {children}
      </PromptFrame>
    )
  }

  if (isEventFirst) {
    return (
      <div className={cn("px-6 py-10 sm:px-12", className)}>
        <div className="mx-auto w-full max-w-2xl">
          {showSessionCard && draft ? (
            <SessionCardPreview draft={draft} className="mb-8" />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          {helper ? (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {helper}
            </p>
          ) : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-16",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-1 flex-col px-6 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16",
          centered && "items-center justify-center text-center",
          isSplit && "lg:max-w-[55%] lg:shrink-0"
        )}
      >
        <div
          className={cn(
            "w-full",
            isSplit ? "max-w-xl" : "max-w-3xl",
            centered && "mx-auto"
          )}
        >
          {localeBadge ? (
            <p className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              {localeBadge}
            </p>
          ) : null}
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              isSplit
                ? "text-3xl sm:text-[2rem] sm:leading-tight"
                : "text-4xl sm:text-[2.75rem] sm:leading-[1.12]"
            )}
          >
            {title}
          </h1>
          {helper ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl sm:leading-relaxed">
              {helper}
            </p>
          ) : null}
          <div
            className={cn(
              "mt-10 sm:mt-12",
              centered && "flex flex-col items-center"
            )}
          >
            {children}
          </div>
        </div>
      </div>
      {illustration ? (
        <div className="relative hidden flex-1 lg:block">
          <div className="sticky top-0 flex h-full min-h-[400px] items-center justify-center p-12">
            <div className="relative aspect-square w-full max-w-lg overflow-hidden rounded-3xl bg-stone-100 shadow-lg ring-1 ring-black/5">
              <Image
                src={illustration}
                alt=""
                fill
                className="object-cover"
                sizes="480px"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
