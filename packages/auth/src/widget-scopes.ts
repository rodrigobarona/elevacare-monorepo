/**
 * WorkOS Widget token scopes — mirrors infra/workos/widgets-config.json.
 * SSOT is the JSON file; update both when adding widgets.
 */

export const WIDGET_TOKEN_SCOPES = {
  userProfile: [] as const,
  userSecurity: [] as const,
  userSessions: ["widgets:users-table:read"] as const,
  usersManagement: ["widgets:users-table:manage"] as const,
  organizationSwitcher: ["widgets:organization-switcher:read"] as const,
} as const

export type WidgetComponent = keyof typeof WIDGET_TOKEN_SCOPES

/** Scopes for widgets.createToken / getWidgetTokenFromSession. */
export function scopesForWidget(component: WidgetComponent): string[] {
  return [...WIDGET_TOKEN_SCOPES[component]]
}
