import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import { guardSessionForOrg, type ElevaSession } from "@eleva/auth"
import { requireSession } from "@eleva/auth/server"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

export async function getAuthedApiClient() {
  await requireSession()
  const incomingHeaders = await headers()
  const cookie = incomingHeaders.get("cookie") ?? ""
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
  })
}

export async function requireMemberOrg(orgSlug: string): Promise<ElevaSession> {
  const session = await guardSessionForOrg(orgSlug)
  if (session.orgSlug !== orgSlug || session.productLabel !== "member") {
    redirect(resolveProductHomeUrl(session))
  }
  return session
}
