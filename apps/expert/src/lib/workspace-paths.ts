import type { ElevaSession } from "@eleva/auth"
import { resolveExpertWorkspaceBase } from "@eleva/auth/org-routing"

/** Base path for expert workspace routes in this app. */
export function expertWorkspaceBase(session: ElevaSession): string {
  const slug = session.orgSlug
  if (!slug) return "/"
  return resolveExpertWorkspaceBase(slug, session.orgType)
}

export function expertWorkspacePath(
  session: ElevaSession,
  segment = ""
): string {
  const base = expertWorkspaceBase(session)
  if (!segment) return base
  return `${base}/${segment.replace(/^\//, "")}`
}
