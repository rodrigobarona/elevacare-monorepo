"use client"

import { useParams } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import { ELEVA_ORG_HEADER } from "@eleva/config/routing"

/** The practice slug in the current address (`/{orgSlug}/…`). */
export function usePracticeSlug(): string | undefined {
  return useParams<{ orgSlug?: string }>()?.orgSlug
}

/**
 * Browser API client that acts for the practice in the address, not the
 * session's active workspace (which can still be the member's Space).
 */
export function practiceApiClient(apiBaseUrl: string, orgSlug?: string) {
  return createApiClient({
    baseUrl: apiBaseUrl,
    ...(orgSlug ? { headers: { [ELEVA_ORG_HEADER]: orgSlug } } : {}),
  })
}
