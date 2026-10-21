import { cache } from "react"
import { headers } from "next/headers"
import {
  createApiClient,
  PUBLIC_SSR_CLIENT_IP_HEADER,
  PUBLIC_SSR_SECRET_HEADER,
  type PublicSlot,
} from "@eleva/api-client"
import { sameSlotInstant } from "./booking-selection"

function serverApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (process.env.NODE_ENV === "development") return "http://localhost:3002"
  throw new Error("NEXT_PUBLIC_API_URL is required outside development")
}

const visitorForwardHeaders = cache(
  async (): Promise<Record<string, string>> => {
    const secret = process.env.PUBLIC_SSR_SHARED_SECRET
    if (!secret) return {}
    const hdrs = await headers()
    const ip =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip")?.trim()
    if (!ip) return {}
    return {
      [PUBLIC_SSR_CLIENT_IP_HEADER]: ip,
      [PUBLIC_SSR_SECRET_HEADER]: secret,
    }
  }
)

/** Public API client for Server Components, rate-limited per visitor. */
export async function createServerPublicApiClient() {
  return createApiClient({
    baseUrl: serverApiBaseUrl(),
    headers: await visitorForwardHeaders(),
  })
}

export const getPublicExpert = cache(async (username: string) => {
  const api = await createServerPublicApiClient()
  return api.public.getExpert(username)
})

export const getPublicEventType = cache(
  async (username: string, eventSlug: string) => {
    const api = await createServerPublicApiClient()
    return api.public.getEventType(username, eventSlug)
  }
)

export const getPublicBookingLink = cache(async (token: string) => {
  const api = await createServerPublicApiClient()
  return api.public.getBookingLink(token)
})

const SLOT_LOOKUP_MS = 2 * 60 * 60 * 1000

export async function findPublicSlot(input: {
  username: string
  eventSlug: string
  modeId: string
  start: string
  timeZone: string
}): Promise<PublicSlot | null> {
  const from = new Date(input.start)
  if (Number.isNaN(from.getTime())) return null
  try {
    const api = await createServerPublicApiClient()
    const result = await api.public.getSlots(input.username, input.eventSlug, {
      modeId: input.modeId,
      from: new Date(from.getTime() - 60_000).toISOString(),
      to: new Date(from.getTime() + SLOT_LOOKUP_MS).toISOString(),
      tz: input.timeZone,
    })
    return (
      result.slots.find((slot) => sameSlotInstant(slot.start, input.start)) ??
      null
    )
  } catch {
    return null
  }
}
