"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createApiClient,
  SetActiveOrganizationRequestSchema,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { gatewayUrl } from "./gateway-url"

function resolveReturnPath(value: string | undefined): string {
  if (!value) return "/dashboard"
  return sanitizeReturnTo(value) ?? "/dashboard"
}

function cookieCsrfHeaders(incoming: Headers): Record<string, string> {
  const forwarded: Record<string, string> = {}
  const cookie = incoming.get("cookie")
  if (cookie) forwarded.cookie = cookie
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host")
  const origin =
    incoming.get("origin") ??
    (host
      ? `${incoming.get("x-forwarded-proto") ?? "https"}://${host.split(",")[0]!.trim()}`
      : null)
  if (origin) forwarded.origin = origin
  const secFetchSite = incoming.get("sec-fetch-site")
  if (secFetchSite) forwarded["sec-fetch-site"] = secFetchSite
  return forwarded
}

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

/**
 * Sets the Better Auth active organization, then redirects through
 * the gateway to the target org home (multi-zone safe in dev).
 */
export async function switchOrganization(
  organizationId: string,
  returnTo?: string
): Promise<void> {
  const parsed = SetActiveOrganizationRequestSchema.parse({ organizationId })
  await requireSession()
  const incomingHeaders = await headers()
  const api = createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookieCsrfHeaders(incomingHeaders),
  })
  await api.organizations.setActive({ organizationId: parsed.organizationId })
  revalidatePath("/", "layout")
  redirect(gatewayUrl(resolveReturnPath(returnTo)))
}
