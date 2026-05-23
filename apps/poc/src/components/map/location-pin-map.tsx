"use client"

import * as React from "react"
import { resolveMapCenter } from "@/lib/map-basemaps"
import { debounce, geocodeAddress } from "@/lib/nominatim"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"
import { CartoMap } from "./carto-map"
import { LocationPinOverlay } from "./country-preview-map"

export interface LocationPinMapProps {
  draft: ExpertDraft
  onCoordsChange: (lat: number, lng: number) => void
}

export function LocationPinMap({ draft, onCoordsChange }: LocationPinMapProps) {
  const center = resolveMapCenter(draft)
  const [view, setView] = React.useState(center)

  React.useEffect(() => {
    setView(resolveMapCenter(draft))
  }, [draft.meetingLatitude, draft.meetingLongitude, draft.practiceCountry])

  const handleMoveEnd = React.useCallback(
    (lat: number, lng: number) => {
      setView((prev) => ({ ...prev, lat, lng }))
      onCoordsChange(lat, lng)
    },
    [onCoordsChange]
  )

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[inherit] bg-muted">
      <CartoMap
        lat={view.lat}
        lng={view.lng}
        zoom={view.zoom}
        onMoveEnd={handleMoveEnd}
        className="absolute inset-0"
      />
      <LocationPinOverlay />
    </div>
  )
}

export interface AddressSearchMapProps {
  draft: ExpertDraft
  placeholder?: string
  onChange: (patch: Partial<ExpertDraft>) => void
}

export function AddressSearchMap({
  draft,
  placeholder,
  onChange,
}: AddressSearchMapProps) {
  const center = resolveMapCenter(draft)
  const [view, setView] = React.useState(center)
  const [query, setQuery] = React.useState(draft.meetingAddress)
  const [searching, setSearching] = React.useState(false)

  React.useEffect(() => {
    setQuery(draft.meetingAddress)
  }, [draft.meetingAddress])

  React.useEffect(() => {
    setView(resolveMapCenter(draft))
  }, [draft.meetingLatitude, draft.meetingLongitude, draft.practiceCountry])

  const runGeocode = React.useMemo(
    () =>
      debounce(async (value: string) => {
        if (value.trim().length < 5) return
        setSearching(true)
        try {
          const result = await geocodeAddress(value, draft.practiceCountry)
          if (result) {
            setView({ lat: result.lat, lng: result.lng, zoom: center.zoom })
            onChange({
              meetingAddress: result.displayName,
              meetingLatitude: result.lat,
              meetingLongitude: result.lng,
            })
          }
        } finally {
          setSearching(false)
        }
      }, 400),
    [draft.practiceCountry, center.zoom, onChange]
  )

  const handleInput = (value: string) => {
    setQuery(value)
    onChange({ meetingAddress: value })
    runGeocode(value)
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder ?? "Street, city"}
        className="flex h-14 w-full rounded-xl border border-input bg-background px-4 text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <div className="relative aspect-[16/10] w-full bg-muted">
          <CartoMap
            lat={view.lat}
            lng={view.lng}
            zoom={view.zoom}
            interactive={false}
            scrollWheelZoom={false}
            syncCenter
            className="absolute inset-0"
          />
          <LocationPinOverlay />
        </div>
        <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          {searching
            ? "Searching OpenStreetMap…"
            : "Type an address — map updates from Nominatim geocoding"}
        </p>
      </div>
    </div>
  )
}
