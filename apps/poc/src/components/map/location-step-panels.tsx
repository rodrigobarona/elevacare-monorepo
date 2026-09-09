"use client"

import * as React from "react"
import { LocationStepLayout } from "@/components/map/location-step-layout"
import { CountryLocationPicker } from "@/components/map/country-location-picker"
import { buildMapDraftPreview, type LocationMapStage } from "@/lib/map-basemaps"
import { reverseGeocode } from "@/lib/nominatim"
import {
  COUNTRY_LABELS,
  type ExpertDraft,
  type PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"
import type { WizardStep } from "@/lib/wizard-types"

interface CountryLocationStepProps {
  step: WizardStep
  draft: ExpertDraft
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
}

export function CountryLocationStep({
  step,
  draft,
  onChange,
}: CountryLocationStepProps) {
  const [previewCountry, setPreviewCountry] =
    React.useState<PracticeCountry | null>(null)
  const [mapEngaged, setMapEngaged] = React.useState(false)

  const mapDraft = previewCountry
    ? buildMapDraftPreview(draft, previewCountry)
    : draft
  const mapStage: LocationMapStage =
    !mapEngaged && !previewCountry ? "world" : "country"

  return (
    <LocationStepLayout
      title={step.title}
      helper={
        step.helper ??
        "Start from the world view — select your country and the map flies in."
      }
      draft={mapDraft}
      stage={mapStage}
      mapFooter={
        previewCountry
          ? `Previewing ${COUNTRY_LABELS[previewCountry]}`
          : mapEngaged
            ? "Country selected — continue to pick your city"
            : "Hover or select a country to zoom in from the world"
      }
    >
      <CountryLocationPicker
        draft={draft}
        onChange={(patch) => {
          setMapEngaged(true)
          setPreviewCountry(null)
          onChange(patch)
        }}
        onPreviewCountry={setPreviewCountry}
      />
    </LocationStepLayout>
  )
}

interface MapConfirmLocationStepProps {
  step: WizardStep
  draft: ExpertDraft
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
}

export function MapConfirmLocationStep({
  step,
  draft,
  onChange,
}: MapConfirmLocationStepProps) {
  const handleCoordsChange = React.useCallback(
    (lat: number, lng: number) => {
      onChange({ meetingLatitude: lat, meetingLongitude: lng })
      void reverseGeocode(lat, lng).then((address) => {
        if (address) {
          onChange({
            meetingAddress: address,
            meetingLatitude: lat,
            meetingLongitude: lng,
          })
        }
      })
    },
    [onChange]
  )

  return (
    <LocationStepLayout
      title={step.title}
      helper={step.helper ?? "Drag the map to reposition the pin."}
      draft={draft}
      stage="pin"
      onCoordsChange={handleCoordsChange}
      mapFooter={draft.meetingAddress || "Pan the map — the pin stays centered"}
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        {draft.meetingAddress
          ? `Pin set near: ${draft.meetingAddress}`
          : "Enter your address on the previous step, then fine-tune the pin here."}
      </p>
    </LocationStepLayout>
  )
}
