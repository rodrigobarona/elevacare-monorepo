"use server"

import { getWidgetTokenFromSession } from "@eleva/auth/server"
import { UnauthorizedError } from "@eleva/auth"
import { resolveGatewayUrl } from "@eleva/config/env"
import type { DashboardConfig, NavGroup } from "./nav-types"

interface SessionLike {
  user: {
    displayName?: string | null
    email: string
    avatarUrl?: string | null
  }
  orgSlug?: string | null
  capabilities?: readonly string[]
}

const GATEWAY_URL = resolveGatewayUrl()

/**
 * Build a complete DashboardConfig from a session and app-specific nav groups.
 *
 * Centralises the shared defaults (user mapping, URLs, widget token) so app
 * layouts only need to supply `navGroups` and optional overrides.
 */
export async function buildDashboardConfig(
  session: SessionLike,
  navGroups: NavGroup[],
  overrides?: Partial<Omit<DashboardConfig, "navGroups" | "user">>
): Promise<DashboardConfig> {
  const fetchWidget = session.orgSlug != null
  const widgetToken = fetchWidget
    ? await getWidgetTokenFromSession().catch((err) => {
        if (!(err instanceof UnauthorizedError)) {
          console.error("Unexpected error generating widget token", err)
          throw err
        }
        return null
      })
    : null

  return {
    navGroups,
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    orgSlug: session.orgSlug,
    capabilities: session.capabilities,
    widgetToken,
    accountUrl: `${GATEWAY_URL}/account/settings`,
    homepageUrl: `${GATEWAY_URL}/home`,
    logoutUrl: `${GATEWAY_URL}/logout`,
    ...overrides,
  }
}
