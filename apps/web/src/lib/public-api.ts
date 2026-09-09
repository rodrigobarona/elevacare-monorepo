import { createApiClient } from "@eleva/api-client"

export function createPublicApiClient() {
  return createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002",
  })
}
