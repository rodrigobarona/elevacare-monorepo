import type { ProductLabel, OrgType } from "@eleva/auth/types"
import {
  resolveAcademyWorkspaceBase,
  resolveExpertWorkspaceBase,
  resolveTeamWorkspaceBase,
} from "@eleva/auth/org-routing"
import { resolveGatewayUrl } from "@eleva/config/env"
import { SPACE_BASE } from "@eleva/config/routing"

export interface ProductHomeSession {
  orgSlug?: string | null
  productLabel: ProductLabel
  orgType?: OrgType | string | null
}

const GATEWAY_URL = resolveGatewayUrl()

const DEPLOYED_ADMIN_URL = "https://admin.eleva.care"
const LOCAL_ADMIN_URL = "http://localhost:3007"

/**
 * Staff console origin. Every deployed app (production and previews) links to
 * the one console at admin.eleva.care unless ADMIN_URL says otherwise; only a
 * local run falls back to the local admin port.
 */
export function resolveAdminUrl(): string {
  const fromEnv = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL
  if (fromEnv) return fromEnv
  return process.env.VERCEL_ENV ? DEPLOYED_ADMIN_URL : LOCAL_ADMIN_URL
}

/** Gateway URL for the user's product dashboard (Back from global settings). */
export function resolveProductHomeUrl(session: ProductHomeSession): string {
  if (!session.orgSlug) {
    return `${GATEWAY_URL}/dashboard`
  }

  const slug = session.orgSlug
  switch (session.productLabel) {
    case "expert":
      return `${GATEWAY_URL}${resolveExpertWorkspaceBase(slug)}`
    case "team_admin":
      return `${GATEWAY_URL}${resolveTeamWorkspaceBase(slug)}`
    case "lecturer":
      return `${GATEWAY_URL}${resolveAcademyWorkspaceBase(slug)}`
    case "staff":
      return resolveAdminUrl()
    case "member":
    default:
      return `${GATEWAY_URL}${SPACE_BASE}`
  }
}
