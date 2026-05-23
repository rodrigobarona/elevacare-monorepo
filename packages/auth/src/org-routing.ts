import {
  ORG_SCOPED_SEGMENTS,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "@eleva/config/routing"
import { getOrganizationBySlug } from "@eleva/db"
import type { OrgType } from "@eleva/db/schema"

const TTL_MS = 5 * 60 * 1000
const MAX_ORG_TYPE_CACHE = 500

const orgTypeCache = new Map<
  string,
  { type: OrgType | null; expiresAt: number }
>()

function pruneOrgTypeCache(): void {
  const now = Date.now()
  for (const [slug, entry] of orgTypeCache) {
    if (entry.expiresAt <= now) {
      orgTypeCache.delete(slug)
    }
  }
  while (orgTypeCache.size >= MAX_ORG_TYPE_CACHE) {
    const oldest = orgTypeCache.keys().next().value
    if (oldest === undefined) break
    orgTypeCache.delete(oldest)
  }
}

const orgScopedSegments = new Set<string>(ORG_SCOPED_SEGMENTS)

/** Cached org type lookup for gateway dispatch (slug → org type). */
export async function getOrgTypeBySlug(slug: string): Promise<OrgType | null> {
  const cached = orgTypeCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.type
  }

  const org = await getOrganizationBySlug(slug)
  const type = (org?.type as OrgType | null | undefined) ?? null
  pruneOrgTypeCache()
  orgTypeCache.set(slug, { type, expiresAt: Date.now() + TTL_MS })
  return type
}

/** Slug when the path needs org-type dispatch (not segment-dispatched). */
export function orgSlugNeedingTypeLookup(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0] ?? ""
  const second = segments[1] ?? ""

  if (!first) return null
  if (RESERVED_SLUGS.has(first) || !isOrgSlugShape(first)) return null
  if (second && orgScopedSegments.has(second)) return null

  return first
}

/** Expert workspace base path: lean for expert orgs, /team for clinic experts. */
export function resolveExpertWorkspaceBase(
  orgSlug: string,
  orgType: OrgType | string | null | undefined
): string {
  return orgType === "team" ? `/${orgSlug}/team` : `/${orgSlug}`
}

/** Clinic manager/staff workspace base path. */
export function resolveTeamAdminBase(orgSlug: string): string {
  return `/${orgSlug}/admin`
}
