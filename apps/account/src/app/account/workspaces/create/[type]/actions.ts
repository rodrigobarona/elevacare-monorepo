"use server"

import { headers } from "next/headers"
import { CreateWorkspaceRequestSchema } from "@eleva/api-client"
import { createApiClient } from "@eleva/api-client"
import { deriveProductLabel } from "@eleva/auth/capabilities"
import { requireSession } from "@eleva/auth/server"
import { resolveOrgHomeUrl } from "@eleva/dashboard/resolve-org-home-url"
import { switchOrganization } from "@eleva/dashboard/switch-org-action"

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL environment variable is required but not set"
    )
  }
  return url
}

async function getAuthedApiClient() {
  await requireSession()
  const incomingHeaders = await headers()
  const cookie = incomingHeaders.get("cookie") ?? ""
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    headers: cookie ? { cookie } : undefined,
  })
}

export type CreateWorkspaceState = { ok: false; error: string } | { ok: true }

export async function createWorkspace(
  _prev: CreateWorkspaceState | null,
  formData: FormData
): Promise<CreateWorkspaceState> {
  let workosOrgId: string
  let homeUrl: string

  try {
    const parsed = CreateWorkspaceRequestSchema.parse({
      name: formData.get("name"),
      type: formData.get("type"),
    })

    const api = await getAuthedApiClient()
    const result = await api.organizations.create(parsed)

    workosOrgId = result.workosOrgId
    homeUrl = resolveOrgHomeUrl({
      orgSlug: result.slug,
      productLabel: deriveProductLabel(parsed.type, "admin"),
      orgType: parsed.type,
    })
  } catch (err) {
    console.error("createWorkspace failed", err)
    return { ok: false, error: "create_failed" }
  }

  await switchOrganization(workosOrgId, homeUrl)
  return { ok: true }
}
