import type { PracticeCountry } from "@/domains/expert-onboarding/lib/types"

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
const USER_AGENT = "ElevaPoC/1.0 (product walkthrough; contact: dev@eleva.care)"

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

async function nominatimSearch(
  params: URLSearchParams
): Promise<GeocodeResult | null> {
  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })

  if (!res.ok) return null

  const data = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>
  const hit = data[0]
  if (!hit) return null

  return {
    lat: Number.parseFloat(hit.lat),
    lng: Number.parseFloat(hit.lon),
    displayName: hit.display_name,
  }
}

export async function geocodeCity(
  city: string,
  country: PracticeCountry
): Promise<GeocodeResult | null> {
  const trimmed = city.trim()
  if (trimmed.length < 2) return null

  const params = new URLSearchParams({
    q: `${trimmed}, ${country}`,
    format: "json",
    limit: "1",
    addressdetails: "0",
    countrycodes: country.toLowerCase(),
  })

  return nominatimSearch(params)
}

export async function geocodeAddress(
  query: string,
  country: PracticeCountry
): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return null

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "1",
    addressdetails: "0",
    countrycodes: country.toLowerCase(),
  })

  return nominatimSearch(params)
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
  })

  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })

  if (!res.ok) return null

  const data = (await res.json()) as { display_name?: string }
  return data.display_name ?? null
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
