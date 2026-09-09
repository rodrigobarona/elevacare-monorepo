import { createApiClient } from "@eleva/api-client"

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
