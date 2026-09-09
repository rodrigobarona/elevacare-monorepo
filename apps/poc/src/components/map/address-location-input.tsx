"use client"

import * as React from "react"
import { debounce, geocodeAddress } from "@/lib/nominatim"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

interface AddressLocationInputProps {
  draft: ExpertDraft
  placeholder?: string
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
}

export function AddressLocationInput({
  draft,
  placeholder,
  onChange,
}: AddressLocationInputProps) {
  const [query, setQuery] = React.useState(draft.meetingAddress)
  const [searching, setSearching] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)

  React.useEffect(() => {
    setQuery(draft.meetingAddress)
  }, [draft.meetingAddress])

  const runGeocode = React.useMemo(
    () =>
      debounce(async (value: string) => {
        if (value.trim().length < 5) {
          setStatus(null)
          return
        }
        setSearching(true)
        setStatus(null)
        try {
          const result = await geocodeAddress(value, draft.practiceCountry)
          if (result) {
            onChange({
              meetingAddress: result.displayName,
              meetingLatitude: result.lat,
              meetingLongitude: result.lng,
            })
            setStatus("Address found — check the pin on the map")
          } else {
            setStatus("Address not found — try street and city")
          }
        } finally {
          setSearching(false)
        }
      }, 400),
    [draft.practiceCountry, onChange]
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
      <p className="text-sm text-muted-foreground">
        {searching
          ? "Searching OpenStreetMap…"
          : (status ??
            "Type your meeting address — the map zooms to street level")}
      </p>
    </div>
  )
}
