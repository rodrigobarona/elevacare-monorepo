"use server"

import { headers } from "next/headers"
import { cookies } from "next/headers"
import { createApiClient } from "@eleva/api-client"
import { LAST_ACTIVE_ORG_COOKIE } from "@eleva/config/routing"

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
}

/**
 * Checks if the current user already has a WorkOS org membership
 * (e.g. they were invited). If so, provisions rows in the Eleva DB
 * and skips the space creation step.
 */
export async function checkExistingMembership(): Promise<{
  hasMembership: boolean
}> {
  const incomingHeaders = await headers()
  const cookie = incomingHeaders.get("cookie") ?? ""
  const api = createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
  })

  const result = await api.onboarding.syncExisting()
  if (result.hasMembership) {
    const jar = await cookies()
    jar.set(LAST_ACTIVE_ORG_COOKIE, result.slug, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
    })
    return { hasMembership: true }
  }

  return { hasMembership: false }
}
