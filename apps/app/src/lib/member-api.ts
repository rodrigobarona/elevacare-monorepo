import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import { guardSessionForOrg, type ElevaSession } from "@eleva/auth"
import {
  addressWorkspaceSlug,
  buildApiSessionHeaders,
  requireSession,
  requireSessionForOrg,
} from "@eleva/auth/server"
import { secureApiBaseUrl } from "@eleva/config/api-url"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

/** HTTPS API origin for forwarded session cookies (`@eleva/config/api-url`). */
export function getApiBaseUrl(): string {
  return secureApiBaseUrl()
}

/**
 * API client that acts for the Space in the address (`/{slug}/…`). The
 * session's active workspace can be the person's practice after a switch,
 * and member routes refuse it.
 */
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

export async function requireMemberOrg(orgSlug: string): Promise<ElevaSession> {
  const session = await guardSessionForOrg(orgSlug)
  if (session.orgSlug !== orgSlug || session.productLabel !== "member") {
    redirect(resolveProductHomeUrl(session))
  }
  return session
}
