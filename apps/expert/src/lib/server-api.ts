import { headers } from "next/headers"
import { createApiClient } from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

export async function getAuthedApiClient() {
  await requireSession()
  const incomingHeaders = await headers()
  const cookie = incomingHeaders.get("cookie") ?? ""
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
  })
}
