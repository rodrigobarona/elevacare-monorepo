import { ApiClientError, createApiClient } from "@eleva/api-client"
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

/** Browser-side public API client. Server Components use `public-api-server`. */
export function createPublicApiClient() {
  return createApiClient({
    baseUrl: publicApiBaseUrl(),
  })
}

export function isNotFoundApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}

export function isRateLimitedApiError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 429
}
