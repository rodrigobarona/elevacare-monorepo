import { headers } from "next/headers"
import { createApiClient } from "@eleva/api-client"
import { secureApiBaseUrl } from "@eleva/config/api-url"
import {
  addressWorkspaceSlug,
  buildApiSessionHeaders,
  requireSession,
  requireSessionForOrg,
} from "@eleva/auth/server"
import type { ElevaSession } from "@eleva/auth/types"

/** HTTPS API origin for forwarded session cookies (`@eleva/config/api-url`). */
export function getApiBaseUrl(): string {
  return secureApiBaseUrl()
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
