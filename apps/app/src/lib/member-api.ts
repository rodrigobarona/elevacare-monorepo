import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import { redirectToGatewayLogin, type ElevaSession } from "@eleva/auth"
import {
  addressWorkspaceSlug,
  buildApiSessionHeaders,
  getSession,
  getSpaceSession,
  requireSession,
  requireSessionForOrg,
} from "@eleva/auth/server"
import { ELEVA_PATHNAME_HEADER } from "@eleva/auth/proxy"
import { SPACE_BASE } from "@eleva/config/routing"
import { secureApiBaseUrl } from "@eleva/config/api-url"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

/** HTTPS API origin for forwarded session cookies (`@eleva/config/api-url`). */
export function getApiBaseUrl(): string {
  return secureApiBaseUrl()
}

/**
 * API client that acts for the person's own Space (`/space/…`). The
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

/**
 * Session in the person's own Space, for every page and action under
 * `/space` (ADR-026). Someone without a Space goes to their own home;
 * someone signed out goes to the login page and comes back here.
 */
export async function requireMemberSpace(): Promise<ElevaSession> {
  const session = await getSpaceSession()
  if (session?.productLabel === "member") return session
  const other = session ?? (await getSession())
  if (other) redirect(resolveProductHomeUrl(other))
  const pathname = (await headers()).get(ELEVA_PATHNAME_HEADER)
  redirectToGatewayLogin(pathname ?? SPACE_BASE)
}
