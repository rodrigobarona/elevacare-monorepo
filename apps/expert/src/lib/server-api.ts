import { headers } from "next/headers"
import { createApiClient } from "@eleva/api-client"
import { ELEVA_PATHNAME_HEADER } from "@eleva/auth/proxy"
import {
  buildApiSessionHeaders,
  requireSession,
  requireSessionForOrg,
  workspaceSlugFromPath,
} from "@eleva/auth/server"
import type { ElevaSession } from "@eleva/auth/types"

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

/** The practice this request is for: `/{slug}/…` in its address. */
async function addressWorkspaceSlug(): Promise<string | null> {
  return workspaceSlugFromPath((await headers()).get(ELEVA_PATHNAME_HEADER))
}

/**
 * Session for the practice in the address, with `capability` checked there.
 * Every expert page and action lives under `/{slug}/…`; the session's active
 * workspace can be the person's Space right after a switch or a direct link.
 */
export async function requireExpertSession(
  capability?: string
): Promise<ElevaSession> {
  const slug = await addressWorkspaceSlug()
  return slug
    ? requireSessionForOrg(slug, capability)
    : requireSession(capability)
}

/** API client that acts for the practice in the address. */
export async function getAuthedApiClient() {
  const slug = await addressWorkspaceSlug()
  if (slug) await requireSessionForOrg(slug)
  else await requireSession()
  const incomingHeaders = await headers()
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: buildApiSessionHeaders(incomingHeaders, { orgSlug: slug }),
  })
}
