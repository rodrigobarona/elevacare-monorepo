"use client"

import dynamic from "next/dynamic"

export const ProgressiveLocationMap = dynamic(
  () =>
    import("./progressive-location-map").then((m) => m.ProgressiveLocationMap),
  { ssr: false, loading: () => <MapSkeleton tall /> }
)

export { LocationStepLayout } from "./location-step-layout"
export { CountryLocationPicker } from "./country-location-picker"
export { CityLocationInput } from "./city-location-input"
export { AddressLocationInput } from "./address-location-input"
export { inferLocationMapStage } from "@/lib/map-basemaps"

export const CountryPreviewMap = dynamic(
  () => import("./country-preview-map").then((m) => m.CountryPreviewMap),
  { ssr: false, loading: () => <MapSkeleton /> }
)

export const LocationPinMap = dynamic(
  () => import("./location-pin-map").then((m) => m.LocationPinMap),
  { ssr: false, loading: () => <MapSkeleton tall /> }
)

export const AddressSearchMap = dynamic(
  () => import("./location-pin-map").then((m) => m.AddressSearchMap),
  { ssr: false, loading: () => <MapSkeleton tall /> }
)

function MapSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-muted ${tall ? "aspect-[16/10] w-full" : "aspect-[4/3] w-full"}`}
    />
  )
}
