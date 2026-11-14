"use server"

import { headers } from "next/headers"
import { createApiClient } from "@eleva/api-client"
import { buildApiSessionHeaders } from "@eleva/auth/server"

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
}

/**
 * Checks if the current user already has an organization membership
 * (e.g. they were invited). If so, confirms the local rows and returns the
 * org slug so the page can hand over to the continue route, which records
 * it as the last active org: a page render must not write cookies.
 */
export async function checkExistingMembership(
  _locale?: string
): Promise<{ hasMembership: true; slug: string } | { hasMembership: false }> {
  const incomingHeaders = await headers()
  const api = createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: buildApiSessionHeaders(incomingHeaders),
  })

  const result = await api.onboarding.syncExisting()
  return result.hasMembership
    ? { hasMembership: true, slug: result.slug }
    : { hasMembership: false }
}
