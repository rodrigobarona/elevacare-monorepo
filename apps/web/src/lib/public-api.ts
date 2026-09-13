import { cache } from "react"
import { ApiClientError, createApiClient } from "@eleva/api-client"

function publicApiBaseUrl(): string {
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

export function isNotFoundApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}

export function isRateLimitedApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 429
}
