"use client"

import { MapPinIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { COUNTRY_MAP_PRESETS } from "@/lib/map-basemaps"
import type { PracticeCountry } from "@/domains/expert-onboarding/lib/types"
import { CartoMap } from "./carto-map"

export interface CountryPreviewMapProps {
  country: PracticeCountry
  selected?: boolean
  label: string
  onSelect: () => void
}

export function CountryPreviewMap({
  country,
  selected,
  label,
  onSelect,
}: CountryPreviewMapProps) {
  const preset = COUNTRY_MAP_PRESETS[country]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "overflow-hidden rounded-2xl border text-left transition-all",
        selected
          ? "border-eleva-primary ring-2 ring-eleva-primary/20"
          : "border-border/60 hover:border-eleva-primary/30"
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        <CartoMap
          lat={preset.lat}
          lng={preset.lng}
          zoom={preset.previewZoom}
          interactive={false}
          scrollWheelZoom={false}
          className="absolute inset-0"
        />
      </div>
      <p
        className={cn(
          "px-4 py-3.5 text-center text-base font-medium sm:text-lg",
          selected ? "bg-eleva-primary/5 text-foreground" : "bg-background"
        )}
      >
        {label}
      </p>
    </button>
  )
}

export function LocationPinOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center"
      aria-hidden
    >
      <MapPinIcon
        className="size-10 -translate-y-1/2 text-eleva-primary drop-shadow-md"
        weight="duotone"
      />
    </div>
  )
}
