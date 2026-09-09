import { headers } from "next/headers"
import { normalizeCountry } from "@eleva/ui/lib/booking/countries"

export function normalizeTimeZone(value: string | null): string {
  if (!value) return "Europe/Lisbon"
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return value
  } catch {
    return "Europe/Lisbon"
  }
}

export async function readBookingGeo(): Promise<{
  country: string
  timeZone: string
}> {
  const hdrs = await headers()
  return {
    country: normalizeCountry(hdrs.get("x-vercel-ip-country")),
    timeZone: normalizeTimeZone(hdrs.get("x-vercel-ip-timezone")),
  }
}
