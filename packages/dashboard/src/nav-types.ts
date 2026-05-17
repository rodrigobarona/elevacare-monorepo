import type { ReactNode } from "react"

export interface NavItem {
  title: string
  url: string
  icon: ReactNode
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

export interface DashboardConfig {
  /** Navigation groups rendered in the sidebar */
  navGroups: NavGroup[]
  /** Current user */
  user: DashboardUser
  /** Active org slug (null for standalone dashboards) */
  orgSlug?: string | null
  /** User capabilities for gating nav items */
  capabilities?: readonly string[]
  /** Widget token for the org switcher (omit to hide org switcher) */
  widgetToken?: string | null
  /** Account settings URL */
  accountUrl?: string
  /** Settings page URL (falls back to parent path of accountUrl) */
  settingsUrl?: string
  /** Logout URL */
  logoutUrl?: string
}
