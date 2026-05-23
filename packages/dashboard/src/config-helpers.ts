"use server"

import { listUserOrganizations } from "@eleva/auth/organizations"
import { UnauthorizedError, type ProductLabel } from "@eleva/auth/types"
import { resolveGatewayUrl } from "@eleva/config/env"
import type { DashboardConfig, NavGroup, OrgSwitcherItem } from "./nav-types"
import { resolveProductHomeUrl } from "./resolve-product-home-url"

type BuildDashboardConfigOverrides = Partial<
  Omit<DashboardConfig, "navGroups" | "user">
> & {
  /** When false, skip org switcher token fetch and show sidebar Back link instead */
  enableOrgSwitcher?: boolean
}

interface SessionLike {
  user: {
    workosUserId: string
    displayName?: string | null
    email: string
    avatarUrl?: string | null
  }
  workosOrgId?: string | null
  orgSlug?: string | null
  productLabel?: ProductLabel
  capabilities?: readonly string[]
}

const GATEWAY_URL = resolveGatewayUrl()

/**
 * Build a complete DashboardConfig from a session and app-specific nav groups.
 *
 * Centralises the shared defaults (user mapping, URLs, organizations) so app
 * layouts only need to supply `navGroups` and optional overrides.
 */
export async function buildDashboardConfig(
  session: SessionLike,
  navGroups: NavGroup[],
  overrides?: BuildDashboardConfigOverrides
): Promise<DashboardConfig> {
  const { enableOrgSwitcher = true, ...configOverrides } = overrides ?? {}
  const fetchOrganizations = enableOrgSwitcher && session.orgSlug != null
  const organizations: OrgSwitcherItem[] = fetchOrganizations
    ? await listUserOrganizations({
        workosUserId: session.user.workosUserId,
        currentWorkosOrgId: session.workosOrgId ?? null,
      }).catch((err) => {
        if (!(err instanceof UnauthorizedError)) {
          console.error("Unexpected error loading organizations", err)
          throw err
        }
        return []
      })
    : []

  const homeUrl =
    configOverrides.homeUrl ??
    (!enableOrgSwitcher ? resolveProductHomeUrl(session) : undefined)

  return {
    navGroups,
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
    },
    orgSlug: session.orgSlug,
    capabilities: session.capabilities,
    organizations,
    accountUrl: `${GATEWAY_URL}/account/settings`,
    homepageUrl: `${GATEWAY_URL}/home`,
    logoutUrl: `${GATEWAY_URL}/logout`,
    ...(homeUrl ? { homeUrl } : {}),
    ...configOverrides,
  }
}
