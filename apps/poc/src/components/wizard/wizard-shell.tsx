"use client"

import Link from "next/link"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { ChapterSidebar } from "./chapter-sidebar"
import {
  EventPipelineBar,
  type EventPipelineStage,
} from "@/domains/expert-onboarding/components/wizard/event-pipeline-bar"
import type { ChapterSidebarState } from "@/lib/wizard-navigation"
import type { WizardChapter, WizardVariant } from "@/lib/wizard-types"

interface WizardShellProps {
  variant: WizardVariant
  chapters: WizardChapter[]
  chapterStates: ChapterSidebarState[]
  activeChapterId?: string
  mobileContextLabel?: string
  setupProgress?: { current: number; total: number; active: boolean }
  onSaveExit: () => void
  children: React.ReactNode
  footer: React.ReactNode
  eventPipelineStage?: EventPipelineStage
  expressProgress?: { current: number; total: number }
  isChapterCover?: boolean
  className?: string
}

export function WizardShell({
  variant,
  chapters,
  chapterStates,
  activeChapterId,
  mobileContextLabel,
  setupProgress,
  onSaveExit,
  children,
  footer,
  eventPipelineStage,
  expressProgress,
  isChapterCover = false,
  className,
}: WizardShellProps) {
  const showSidebar =
    (variant === "sidebar" || variant === "split") && chapters.length > 0
  const isGuidedPrompt = variant === "dots"
  const isEventFirst = variant === "event-first"
  const isExpress = variant === "express"

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        isGuidedPrompt ? "bg-white" : "bg-stone-50",
        className
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-4 sm:px-8",
          isGuidedPrompt ? "bg-white" : "bg-background"
        )}
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Eleva
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 pl-4">
          {isExpress && expressProgress ? (
            <span className="rounded-full bg-eleva-primary/10 px-3 py-1 text-xs font-medium text-eleva-primary">
              Almost there · {expressProgress.current} of{" "}
              {expressProgress.total}
            </span>
          ) : null}
          {isEventFirst ? (
            <span className="hidden text-sm font-medium text-muted-foreground sm:block">
              Event-first onboarding
            </span>
          ) : null}
          {variant === "split" ? (
            <span className="hidden text-sm font-medium text-muted-foreground lg:block">
              Live preview mode
            </span>
          ) : null}
          {!isGuidedPrompt && mobileContextLabel ? (
            <p className="truncate text-sm font-medium text-muted-foreground lg:hidden">
              {mobileContextLabel}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onSaveExit}
          >
            Save & exit
          </Button>
        </div>
      </header>

      {isEventFirst && eventPipelineStage ? (
        <EventPipelineBar activeStage={eventPipelineStage} />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showSidebar ? (
          <ChapterSidebar
            chapters={chapters}
            chapterStates={chapterStates}
            activeChapterId={activeChapterId}
            setupProgress={setupProgress}
          />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">
          <main
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              isChapterCover &&
                !isGuidedPrompt &&
                "bg-gradient-to-br from-stone-100 via-stone-50 to-eleva-primary/5",
              isGuidedPrompt && "bg-white"
            )}
          >
            {children}
          </main>
          {footer}
        </div>
      </div>
    </div>
  )
}
