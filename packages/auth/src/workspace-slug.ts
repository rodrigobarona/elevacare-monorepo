import {
  isOrgSlugShape,
  RESERVED_SLUGS,
  SLUGGED_WORKSPACE_NAMESPACES,
} from "@eleva/config/routing"

const sluggedNamespaces = new Set<string>(SLUGGED_WORKSPACE_NAMESPACES)

/** Request header so org layouts can preserve the current path on login. */
export const ELEVA_PATHNAME_HEADER = "x-eleva-pathname"

function asWorkspaceSlug(segment: string | undefined): string | null {
  if (!segment || RESERVED_SLUGS.has(segment) || !isOrgSlugShape(segment)) {
    return null
  }
  return segment
}

/**
 * The workspace a page belongs to, from its address: the second segment of
 * `/expert/{slug}/…` (and the other slugged namespaces, ADR-026), else the
 * first segment of a legacy `/{slug}/…` address, when it has slug shape and
 * is not a reserved route.
 */
export function workspaceSlugFromPath(
  path: string | null | undefined
): string | null {
  const segments = path?.split("?")[0]?.split("/").filter(Boolean) ?? []
  const first = segments[0]
  if (first && sluggedNamespaces.has(first)) {
    return asWorkspaceSlug(segments[1])
  }
  return asWorkspaceSlug(first)
}
