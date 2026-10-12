import { cache } from "react"
import {
  ApiClientError,
  createApiClient,
  type PublicSlot,
} from "@eleva/api-client"
import { sameSlotInstant } from "./booking-selection"
import {
  isSameOriginApiEnabled,
  SAME_ORIGIN_API_PREFIX,
} from "./same-origin-api"

function publicApiBaseUrl(): string {
  if (typeof window !== "undefined" && isSameOriginApiEnabled()) {
    return SAME_ORIGIN_API_PREFIX
  }
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (process.env.NODE_ENV === "development") return "http://localhost:3002"
  throw new Error("NEXT_PUBLIC_API_URL is required outside development")
}

export function createPublicApiClient() {
  return createApiClient({
    baseUrl: publicApiBaseUrl(),
  })
}

export const getPublicExpert = cache(async (username: string) => {
  return createPublicApiClient().public.getExpert(username)
})

export const getPublicEventType = cache(
  async (username: string, eventSlug: string) => {
    return createPublicApiClient().public.getEventType(username, eventSlug)
  }
)

export const getPublicBookingLink = cache(async (token: string) => {
  return createPublicApiClient().public.getBookingLink(token)
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
    const result = await createPublicApiClient().public.getSlots(
      input.username,
      input.eventSlug,
      {
        modeId: input.modeId,
        from: new Date(from.getTime() - 60_000).toISOString(),
        to: new Date(from.getTime() + SLOT_LOOKUP_MS).toISOString(),
        tz: input.timeZone,
      }
    )
    return (
      result.slots.find((slot) => sameSlotInstant(slot.start, input.start)) ??
      null
    )
  } catch {
    return null
  }
}

export function isNotFoundApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}

export function isRateLimitedApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 429
}
