import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createApiClient } from "@eleva/api-client"
import { guardSessionForOrg, type ElevaSession } from "@eleva/auth"
import { requireSession } from "@eleva/auth/server"
import { resolveProductHomeUrl } from "@eleva/dashboard/resolve-product-home-url"

const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function isLocalHttpApiUrl(parsed: URL): boolean {
  return parsed.protocol === "http:" && LOCAL_API_HOSTS.has(parsed.hostname)
}

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be a valid absolute URL")
  }
  if (parsed.protocol === "https:") return url
  if (isLocalHttpApiUrl(parsed)) return url
  throw new Error(
    "NEXT_PUBLIC_API_URL must use HTTPS outside local development"
  )
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
