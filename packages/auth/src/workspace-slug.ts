import { isOrgSlugShape, RESERVED_SLUGS } from "@eleva/config/routing"

/** Request header so org layouts can preserve the current path on login. */
export const ELEVA_PATHNAME_HEADER = "x-eleva-pathname"

/**
 * The workspace a page belongs to, from its address: the first segment of
 * `/{slug}/…` when it has slug shape and is not a reserved route.
 */
export function workspaceSlugFromPath(
  path: string | null | undefined
): string | null {
  const first = path?.split("?")[0]?.split("/").filter(Boolean)[0]
  if (!first || RESERVED_SLUGS.has(first) || !isOrgSlugShape(first)) {
    return null
  }
  return first
}
