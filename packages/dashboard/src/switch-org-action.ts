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
  const cookie = incomingHeaders.get("cookie") ?? ""
  const api = createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
  })
  await api.organizations.setActive({ organizationId: parsed.organizationId })
  revalidatePath("/", "layout")
  redirect(gatewayUrl(resolveReturnPath(returnTo)))
}
