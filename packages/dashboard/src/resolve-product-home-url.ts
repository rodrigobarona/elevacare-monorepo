import type { ProductLabel } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"

export interface ProductHomeSession {
  orgSlug?: string | null
  productLabel?: ProductLabel
}

const GATEWAY_URL = resolveGatewayUrl()

function resolveAdminUrl(): string {
  return (
    process.env.ADMIN_URL ??
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    "http://localhost:3007"
  )
}

/** Gateway URL for the user's product dashboard (Back from global settings). */
export function resolveProductHomeUrl(session: ProductHomeSession): string {
  if (!session.orgSlug) {
    return `${GATEWAY_URL}/dashboard`
  }

  const slug = session.orgSlug
  switch (session.productLabel) {
    case "expert":
      return `${GATEWAY_URL}/${slug}/expert`
    case "team_admin":
      return `${GATEWAY_URL}/${slug}/team`
    case "lecturer":
      return `${GATEWAY_URL}/${slug}/academy`
    case "staff":
      return resolveAdminUrl()
    case "member":
    default:
      return `${GATEWAY_URL}/${slug}`
  }
}
