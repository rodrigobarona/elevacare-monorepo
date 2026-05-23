"use client"

import * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { debounce, geocodeCity } from "@/lib/nominatim"
import type {
  ExpertDraft,
  PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"

const CITY_QUICK_PICKS: Record<PracticeCountry, string[]> = {
  PT: ["Lisbon", "Porto"],
  ES: ["Madrid", "Barcelona"],
  BR: ["São Paulo", "Rio de Janeiro"],
}

interface CityLocationInputProps {
  draft: ExpertDraft
  placeholder?: string
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
}

export function CityLocationInput({
  draft,
  placeholder,
  onChange,
}: CityLocationInputProps) {
  const [query, setQuery] = React.useState(draft.city)
  const [searching, setSearching] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    setQuery(draft.city)
  }, [draft.city])

  const applyCity = React.useCallback(
    (cityName: string, lat: number, lng: number) => {
      onChange({
        city: cityName,
        meetingLatitude: lat,
        meetingLongitude: lng,
        cityGeocoded: true,
      })
      setStatus(`Found ${cityName} on the map`)
    },
    [onChange]
  )

  const runGeocode = React.useMemo(
    () =>
      debounce(async (value: string) => {
        const trimmed = value.trim()
        if (trimmed.length < 2) {
          setStatus(null)
          return
        }
        setSearching(true)
        setStatus(null)
        try {
          const result = await geocodeCity(trimmed, draft.practiceCountry)
          if (result) {
            applyCity(trimmed, result.lat, result.lng)
          } else {
            setStatus("City not found — try a quick pick or check spelling")
            onChange({ cityGeocoded: false })
          }
        } finally {
          setSearching(false)
        }
      }, 500),
    [draft.practiceCountry, applyCity, onChange]
  )

  const handleInput = (value: string) => {
    setQuery(value)
    onChange({ city: value, cityGeocoded: false })
    runGeocode(value)
  }

  const pickCity = async (cityName: string) => {
    setQuery(cityName)
    setSearching(true)
    setStatus(null)
    try {
      const result = await geocodeCity(cityName, draft.practiceCountry)
      if (result) {
        applyCity(cityName, result.lat, result.lng)
      }
    } finally {
      setSearching(false)
    }
  }

  const quickPicks = CITY_QUICK_PICKS[draft.practiceCountry]

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder ?? "Lisbon, Madrid, São Paulo…"}
        className="flex h-14 w-full rounded-xl border border-input bg-background px-4 text-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {quickPicks.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => void pickCity(city)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              draft.city === city
                ? "border-eleva-primary bg-eleva-primary text-primary-foreground"
                : "border-border bg-background hover:border-eleva-primary/40"
            )}
          >
            {city}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {searching
          ? "Locating city on the map…"
          : (status ??
            "Pick a city or type yours — the map zooms in as you go")}
      </p>
    </div>
  )
}
