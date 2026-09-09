import {
  COUNTRY_LABELS,
  type ExpertDraft,
  type PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"

export type LocationMapStage = "world" | "country" | "city" | "address" | "pin"

export interface LocationMapView {
  lat: number
  lng: number
  zoom: number
  interactive: boolean
  showPin: boolean
  label: string
}

/** Atlantic-centered view showing PT, ES, and BR */
export const WORLD_MAP_PRESET = { lat: 20, lng: -20, zoom: 2 }

export const LOCATION_ZOOM = {
  city: 11,
  address: 14,
  pin: 15,
} as const

export interface CartoBasemapConfig {
  id: "positron" | "voyager"
  url: string
  attribution: string
  subdomains: string
  maxZoom: number
}

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export const CARTO_POSITRON: CartoBasemapConfig = {
  id: "positron",
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution: CARTO_ATTRIBUTION,
  subdomains: "abcd",
  maxZoom: 20,
}

/** Colored basemap — alternate for discovery / comps maps in future PoCs */
export const CARTO_VOYAGER: CartoBasemapConfig = {
  id: "voyager",
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution: CARTO_ATTRIBUTION,
  subdomains: "abcd",
  maxZoom: 20,
}

export const DEFAULT_BASEMAP = CARTO_POSITRON

export interface CountryMapPreset {
  lat: number
  lng: number
  zoom: number
  previewZoom: number
}

export const COUNTRY_MAP_PRESETS: Record<PracticeCountry, CountryMapPreset> = {
  PT: { lat: 38.7223, lng: -9.1393, zoom: 13, previewZoom: 6 },
  ES: { lat: 40.4168, lng: -3.7038, zoom: 13, previewZoom: 6 },
  BR: { lat: -23.5505, lng: -46.6333, zoom: 13, previewZoom: 5 },
}

export function getCountryCenter(country: PracticeCountry): {
  lat: number
  lng: number
} {
  const { lat, lng } = COUNTRY_MAP_PRESETS[country]
  return { lat, lng }
}

export function resolveMapCenter(
  draft: {
    practiceCountry: PracticeCountry
    meetingLatitude: number | null
    meetingLongitude: number | null
  },
  zoomLevel: "default" | "preview" = "default"
): { lat: number; lng: number; zoom: number } {
  const preset = COUNTRY_MAP_PRESETS[draft.practiceCountry]
  if (draft.meetingLatitude != null && draft.meetingLongitude != null) {
    return {
      lat: draft.meetingLatitude,
      lng: draft.meetingLongitude,
      zoom: preset.zoom,
    }
  }
  return {
    lat: preset.lat,
    lng: preset.lng,
    zoom: zoomLevel === "preview" ? preset.previewZoom : preset.zoom,
  }
}

function buildLocationLabel(
  draft: ExpertDraft,
  stage: LocationMapStage
): string {
  const country = COUNTRY_LABELS[draft.practiceCountry]
  const city = draft.city.trim()

  if (stage === "world") return "Eleva · Worldwide"
  if (stage === "country") return `Eleva · ${country}`
  if (city) return `Eleva · ${country} · ${city}`
  return `Eleva · ${country}`
}

export function getLocationMapView(
  draft: ExpertDraft,
  stage: LocationMapStage
): LocationMapView {
  const preset = COUNTRY_MAP_PRESETS[draft.practiceCountry]
  const hasCoords =
    draft.meetingLatitude != null && draft.meetingLongitude != null
  const label = buildLocationLabel(draft, stage)

  if (stage === "world") {
    return {
      ...WORLD_MAP_PRESET,
      interactive: false,
      showPin: false,
      label: "Eleva · Worldwide",
    }
  }

  if (stage === "country") {
    return {
      lat: preset.lat,
      lng: preset.lng,
      zoom: preset.previewZoom,
      interactive: false,
      showPin: false,
      label,
    }
  }

  if (stage === "city") {
    if (hasCoords) {
      return {
        lat: draft.meetingLatitude!,
        lng: draft.meetingLongitude!,
        zoom: LOCATION_ZOOM.city,
        interactive: false,
        showPin: true,
        label,
      }
    }
    return {
      lat: preset.lat,
      lng: preset.lng,
      zoom: preset.previewZoom,
      interactive: false,
      showPin: false,
      label,
    }
  }

  if (stage === "address") {
    const lat = hasCoords ? draft.meetingLatitude! : preset.lat
    const lng = hasCoords ? draft.meetingLongitude! : preset.lng
    return {
      lat,
      lng,
      zoom: LOCATION_ZOOM.address,
      interactive: false,
      showPin: true,
      label,
    }
  }

  // pin
  const lat = hasCoords ? draft.meetingLatitude! : preset.lat
  const lng = hasCoords ? draft.meetingLongitude! : preset.lng
  return {
    lat,
    lng,
    zoom: LOCATION_ZOOM.pin,
    interactive: true,
    showPin: true,
    label,
  }
}

export function resetLocationForCountry(
  country: PracticeCountry
): Pick<
  ExpertDraft,
  | "practiceCountry"
  | "city"
  | "meetingAddress"
  | "meetingLatitude"
  | "meetingLongitude"
  | "cityGeocoded"
> {
  const { lat, lng } = getCountryCenter(country)
  return {
    practiceCountry: country,
    city: "",
    meetingAddress: "",
    meetingLatitude: lat,
    meetingLongitude: lng,
    cityGeocoded: false,
  }
}

export function buildMapDraftPreview(
  draft: ExpertDraft,
  country: PracticeCountry
): ExpertDraft {
  const { lat, lng } = getCountryCenter(country)
  return {
    ...draft,
    practiceCountry: country,
    meetingLatitude: lat,
    meetingLongitude: lng,
  }
}

export function inferLocationMapStage(draft: ExpertDraft): LocationMapStage {
  if (draft.meetingAddress.trim().length >= 5) return "address"
  if (draft.cityGeocoded && draft.city.trim()) return "city"
  return "country"
}
