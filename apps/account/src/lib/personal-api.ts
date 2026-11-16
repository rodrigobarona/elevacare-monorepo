import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import {
  buildApiSessionHeaders,
  getSpaceSlug,
  requireSession,
} from "@eleva/auth/server"
import { secureApiBaseUrl } from "@eleva/config/api-url"

/**
 * API client for the person's own data: profile, notifications, consents,
 * data copies and deletion (`/me`, `/users`, `/privacy`). Those routes act
 * for the person's own Space, so the request names it, whatever workspace
 * the session last had open. Everyone gets a Space when their account is
 * created; anyone still without one finishes that step in onboarding.
 */
export async function getPersonalApiClient() {
  await requireSession()
  const [slug, incoming] = await Promise.all([getSpaceSlug(), headers()])
  if (!slug) redirect("/onboarding")
  return createApiClient({
    baseUrl: secureApiBaseUrl(),
    headers: buildApiSessionHeaders(incoming, { orgSlug: slug }),
  })
}
