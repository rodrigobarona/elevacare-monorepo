/**
 * Shared WorkOS Authorization API helpers for infra/workos scripts.
 */

export const WORKOS_API_BASE = "https://api.workos.com"

export interface WorkOSPermission {
  slug: string
  name: string
  description?: string
  system?: boolean
}

export interface WorkOSRole {
  slug: string
  name: string
  description?: string
  type?: string
  permissions?: string[]
}

export const WORKOS_ROLE_DESCRIPTION_MAX = 150

export function truncateRoleDescription(
  description: string | undefined,
  max = WORKOS_ROLE_DESCRIPTION_MAX
): string | undefined {
  if (description === undefined) return description
  const chars = [...description]
  if (chars.length <= max) return description
  return `${chars.slice(0, max - 1).join("")}…`
}

export function resolveWorkosApiKey(envName: string): {
  apiKey: string | undefined
  apiKeyEnv: string
} {
  const apiKeyEnv =
    envName === "production" ? "WORKOS_API_KEY_PRODUCTION" : "WORKOS_API_KEY"
  const apiKey = process.env[apiKeyEnv] ?? process.env.WORKOS_API_KEY
  return { apiKey, apiKeyEnv }
}

export function parseCliEnv(argv: string[]): string {
  const envArg = argv.find((a) => a.startsWith("--env="))
  const raw = envArg?.split("=")[1]
  if (!raw) return "staging"

  const aliases: Record<string, string> = {
    prod: "production",
    dev: "development",
  }
  const normalized = aliases[raw] ?? raw
  const allowed = new Set(["staging", "production", "development"])

  if (!allowed.has(normalized)) {
    throw new Error(
      `Invalid --env=${raw}. Allowed: staging, production, development (aliases: prod, dev).`
    )
  }

  return normalized
}

export async function workosRequest<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${WORKOS_API_BASE}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WorkOS ${method} ${path} → ${res.status}: ${text}`)
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return {} as T
  }

  return res.json() as Promise<T>
}

export async function listAllPermissions(
  apiKey: string
): Promise<WorkOSPermission[]> {
  const all: WorkOSPermission[] = []
  let after: string | undefined

  while (true) {
    const params = new URLSearchParams({ limit: "100" })
    if (after) params.set("after", after)

    const res = await workosRequest<{
      data: WorkOSPermission[]
      list_metadata: { after: string | null }
    }>(apiKey, "GET", `/authorization/permissions?${params}`)

    all.push(...res.data)
    if (!res.list_metadata.after) break
    after = res.list_metadata.after
  }

  return all
}

export async function listEnvironmentRoles(
  apiKey: string
): Promise<WorkOSRole[]> {
  const res = await workosRequest<{ data: WorkOSRole[] }>(
    apiKey,
    "GET",
    "/authorization/roles"
  )
  return res.data
}

export async function getEnvironmentRole(
  apiKey: string,
  slug: string
): Promise<WorkOSRole> {
  return workosRequest<WorkOSRole>(
    apiKey,
    "GET",
    `/authorization/roles/${slug}`
  )
}

export async function deletePermission(
  apiKey: string,
  slug: string
): Promise<void> {
  await workosRequest(apiKey, "DELETE", `/authorization/permissions/${slug}`)
}

export async function createPermission(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  await workosRequest(apiKey, "POST", "/authorization/permissions", {
    slug,
    name,
    ...(description !== undefined && { description }),
  })
}

export async function updatePermission(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  await workosRequest(apiKey, "PATCH", `/authorization/permissions/${slug}`, {
    name,
    ...(description !== undefined && { description }),
  })
}

export async function createRole(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  const safeDescription = truncateRoleDescription(description)
  await workosRequest(apiKey, "POST", "/authorization/roles", {
    slug,
    name,
    ...(safeDescription !== undefined && { description: safeDescription }),
  })
}

export async function updateRole(
  apiKey: string,
  slug: string,
  name: string,
  description?: string
): Promise<void> {
  const safeDescription = truncateRoleDescription(description)
  await workosRequest(apiKey, "PATCH", `/authorization/roles/${slug}`, {
    name,
    ...(safeDescription !== undefined && { description: safeDescription }),
  })
}

export async function setRolePermissions(
  apiKey: string,
  roleSlug: string,
  permissions: string[]
): Promise<void> {
  await workosRequest(
    apiKey,
    "PUT",
    `/authorization/roles/${roleSlug}/permissions`,
    { permissions }
  )
}
