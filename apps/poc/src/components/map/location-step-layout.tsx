"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { cn } from "@eleva/ui/lib/utils"
import type { LocationMapStage } from "@/lib/map-basemaps"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

const ProgressiveLocationMap = dynamic(
  () =>
    import("./progressive-location-map").then((m) => m.ProgressiveLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[320px] w-full animate-pulse rounded-2xl bg-muted lg:min-h-[480px]" />
    ),
  }
)

interface LocationStepLayoutProps {
  title: string
  helper?: string
  draft: ExpertDraft
  stage: LocationMapStage
  onCoordsChange?: (lat: number, lng: number) => void
  children: React.ReactNode
  mapFooter?: React.ReactNode
  className?: string
}

export function LocationStepLayout({
  title,
  helper,
  draft,
  stage,
  onCoordsChange,
  children,
  mapFooter,
  className,
}: LocationStepLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-10",
        className
      )}
    >
      <div className="flex flex-1 flex-col px-6 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
        <div className="w-full max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.12]">
            {title}
          </h1>
          {helper ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {helper}
            </p>
          ) : null}
          <div className="mt-10 sm:mt-12">{children}</div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col border-t border-border/40 bg-stone-100/50 px-6 py-8 lg:w-[min(480px,46%)] lg:border-t-0 lg:border-l lg:px-8 lg:py-10">
        <p className="mb-4 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Your place on Eleva
        </p>
        <ProgressiveLocationMap
          draft={draft}
          stage={stage}
          onCoordsChange={onCoordsChange}
        />
        {mapFooter ? (
          <p className="mt-3 text-sm text-muted-foreground">{mapFooter}</p>
        ) : null}
      </div>
    </div>
  )
}
