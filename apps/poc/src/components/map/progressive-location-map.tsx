"use client"

import * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { getLocationMapView, type LocationMapStage } from "@/lib/map-basemaps"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"
import { CartoMap } from "./carto-map"
import { LocationPinOverlay } from "./country-preview-map"

export interface ProgressiveLocationMapProps {
  draft: ExpertDraft
  stage: LocationMapStage
  onCoordsChange?: (lat: number, lng: number) => void
  className?: string
  compact?: boolean
}

export function ProgressiveLocationMap({
  draft,
  stage,
  onCoordsChange,
  className,
  compact = false,
}: ProgressiveLocationMapProps) {
  const view = getLocationMapView(draft, stage)
  const [panCoords, setPanCoords] = React.useState<{
    lat: number
    lng: number
  } | null>(null)

  React.useEffect(() => {
    setPanCoords(null)
  }, [
    view.lat,
    view.lng,
    view.zoom,
    stage,
    draft.practiceCountry,
    draft.city,
    draft.meetingAddress,
  ])

  const displayLat = panCoords?.lat ?? view.lat
  const displayLng = panCoords?.lng ?? view.lng

  const handleMoveEnd = React.useCallback(
    (lat: number, lng: number) => {
      setPanCoords({ lat, lng })
      onCoordsChange?.(lat, lng)
    },
    [onCoordsChange]
  )

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-muted",
        compact
          ? "aspect-[16/10] w-full"
          : "min-h-[320px] w-full lg:min-h-[480px]",
        className
      )}
    >
      <CartoMap
        lat={displayLat}
        lng={displayLng}
        zoom={view.zoom}
        interactive={view.interactive}
        scrollWheelZoom={view.interactive}
        syncCenter
        animateCenter
        onMoveEnd={view.interactive ? handleMoveEnd : undefined}
        className="absolute inset-0"
      />
      {view.showPin ? <LocationPinOverlay /> : null}
      <div className="pointer-events-none absolute top-4 left-4 z-[1001] rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
        {view.label}
      </div>
    </div>
  )
}
