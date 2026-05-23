"use client"

import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import type { ChapterSidebarState } from "@/lib/wizard-navigation"
import type { WizardChapter } from "@/lib/wizard-types"

interface ChapterSidebarProps {
  chapters: WizardChapter[]
  chapterStates: ChapterSidebarState[]
  activeChapterId?: string
  setupProgress?: { current: number; total: number; active: boolean }
  className?: string
}

export function ChapterSidebar({
  chapters,
  chapterStates,
  activeChapterId,
  setupProgress,
  className,
}: ChapterSidebarProps) {
  const stateById = new Map(chapterStates.map((s) => [s.id, s]))
  const setupActive = setupProgress?.active ?? false

  return (
    <aside
      className={cn(
        "hidden w-80 shrink-0 flex-col border-r border-stone-800 bg-stone-950 text-stone-100 lg:flex",
        className
      )}
    >
      <div className="border-b border-stone-800 px-6 py-6">
        <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">
          Your progress
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-white">
          Expert profile
        </p>
      </div>
      <nav className="flex-1 space-y-2 p-4">
        {setupProgress ? (
          <div
            className={cn(
              "rounded-2xl px-4 py-3.5 transition-colors",
              setupActive ? "bg-stone-800" : "bg-stone-900/40 opacity-70"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  setupActive
                    ? "bg-white text-stone-950"
                    : "bg-stone-800 text-stone-400"
                )}
              >
                {setupActive ? (
                  setupProgress.current
                ) : (
                  <CheckIcon className="size-4" weight="bold" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-base font-medium",
                    setupActive ? "text-white" : "text-stone-400"
                  )}
                >
                  Setup
                </span>
                {setupActive ? (
                  <p className="mt-1 text-xs text-stone-400">
                    Step {setupProgress.current} of {setupProgress.total}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">Complete</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {chapters.map((chapter) => {
          const Icon = chapter.icon
          const state = stateById.get(chapter.id)
          const active = chapter.id === activeChapterId
          const complete = state?.status === "complete"

          return (
            <div
              key={chapter.id}
              className={cn(
                "rounded-2xl px-4 py-3.5 transition-colors",
                active
                  ? "bg-stone-800"
                  : complete
                    ? "bg-stone-900/60"
                    : "opacity-70"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    complete
                      ? "bg-eleva-primary text-primary-foreground"
                      : active
                        ? "bg-white text-stone-950"
                        : "bg-stone-800 text-stone-400"
                  )}
                >
                  {complete ? (
                    <CheckIcon className="size-4" weight="bold" />
                  ) : (
                    (state?.index ?? "·")
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {Icon ? (
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-eleva-primary" : "text-stone-500"
                        )}
                        weight={active ? "fill" : "regular"}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "text-base leading-snug font-medium",
                        active ? "text-white" : "text-stone-300"
                      )}
                    >
                      {chapter.label}
                    </span>
                  </div>
                  {active && state && state.questionTotal > 0 ? (
                    <div className="mt-2.5">
                      <p className="text-xs text-stone-400">
                        {state.status === "active" &&
                        state.questionCurrent === 0
                          ? "Chapter intro"
                          : `Question ${Math.max(state.questionCurrent, 0)} of ${state.questionTotal}`}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {Array.from({ length: state.questionTotal }).map(
                          (_, i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-1 flex-1 rounded-full",
                                i < state.questionCurrent
                                  ? "bg-eleva-primary"
                                  : "bg-stone-700"
                              )}
                            />
                          )
                        )}
                      </div>
                    </div>
                  ) : complete ? (
                    <p className="mt-1 text-xs text-stone-500">Complete</p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
