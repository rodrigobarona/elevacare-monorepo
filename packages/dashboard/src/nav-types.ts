import type { NavIconName } from "@eleva/icons"
import type { OrgType, ProductLabel } from "@eleva/auth/types"
import type { AccountMenuModel } from "./account-menu-model"

export interface NavItem {
  title: string
  url: string
  /** Serializable icon key — resolved client-side via getNavIcon. */
  icon: NavIconName
  /** Required capability to show this item; omit for always visible */
  needs?: string
  shortcut?: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export interface DashboardUser {
  displayName?: string | null
  email: string
  avatarUrl?: string | null
}

export interface OrgSwitcherItem {
  orgId: string
  orgSlug: string
  orgType: OrgType
  name: string
  membershipRole: "admin" | "member"
  productLabel: ProductLabel
  isCurrent: boolean
}

/** The expert practice the person owns (one per person, ADR-026). */
export interface ExistingPractice {
  name: string
  href: string
}

export interface DashboardConfig {
  /** Navigation groups rendered in the sidebar */
  navGroups: NavGroup[]
  /** Current user */
  user: DashboardUser
  /** Active org slug (null for standalone dashboards) */
  orgSlug?: string | null
  /** Override the sidebar "Back" link destination (defaults to /{orgSlug} or /) */
  homeUrl?: string
  /** User capabilities for gating nav items */
  capabilities?: readonly string[]
  /** Organizations for the workspace switcher */
  organizations?: OrgSwitcherItem[]
  /** The person's own expert practice, so "Create" opens it instead */
  existingPractice?: ExistingPractice | null
  /** Avatar menu rows, built on the server from the person's memberships */
  accountMenu: AccountMenuModel
  /** Inbox page URL — shows NavBell when set with apiBaseUrl */
  inboxUrl?: string
  /** Public API origin for NavBell SWR (NEXT_PUBLIC_API_URL) */
  apiBaseUrl?: string
}
