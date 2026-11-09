"use server"

import type { ProductLabel } from "@eleva/auth/types"
import { accountMenuFor, loadUserWorkspaces } from "./account-menu-server"
import type { DashboardConfig, NavGroup } from "./nav-types"
import { resolveProductHomeUrl } from "./resolve-product-home-url"

type BuildDashboardConfigOverrides = Partial<
  Omit<DashboardConfig, "navGroups" | "user" | "accountMenu">
> & {
  /** When false, hide the sidebar org switcher and show the Back link instead */
  enableOrgSwitcher?: boolean
  /** Account settings link, for the account app that serves it itself */
  accountHref?: string
}

interface SessionLike {
  user: {
    id: string
    displayName?: string | null
    email: string
    avatarUrl?: string | null
  }
  orgId?: string | null
  orgSlug?: string | null
  productLabel?: ProductLabel
  capabilities?: readonly string[]
}

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
  const {
    enableOrgSwitcher = true,
    accountHref,
    ...configOverrides
  } = overrides ?? {}
  // Every membership, for the avatar menu; the switcher shows them too.
  const workspaces = await loadUserWorkspaces(
    session.user.id,
    session.orgId ?? null
  ).catch((err) => {
    // The page still renders; the menu just has no workspace rows.
    console.error("[buildDashboardConfig] workspace lookup failed", err)
    return []
  })
  const organizations =
    enableOrgSwitcher && session.orgSlug != null ? workspaces : []

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
    accountMenu: accountMenuFor(workspaces, { accountHref }),
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002",
    ...(homeUrl ? { homeUrl } : {}),
    ...configOverrides,
  }
}
