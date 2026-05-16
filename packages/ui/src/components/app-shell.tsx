import * as React from "react"

/**
 * Org membership shape used by the AppShell org switcher.
 * Kept minimal to avoid coupling to `@eleva/auth` types.
 */
export interface OrgMembership {
  orgSlug: string
  orgName?: string
  /** Determines which app URL segment to link to */
  orgType: "personal" | "expert" | "team" | "academy" | string
}

export interface AppShellSession {
  user: {
    displayName?: string | null
    email: string
    avatarUrl?: string | null
  }
  orgSlug: string | null
  capabilities: readonly string[]
}

export interface AppShellNavItem {
  href: string
  label: string
  active?: boolean
}

const ACCOUNT_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_APP_URL || "https://eleva.care"
    : "https://eleva.care"

/**
 * Derive the home URL for an org based on its type.
 */
function orgHomeUrl(membership: OrgMembership): string {
  const slug = membership.orgSlug
  switch (membership.orgType) {
    case "expert":
      return `/${slug}/expert`
    case "team":
      return `/${slug}/team`
    case "academy":
      return `/${slug}/academy`
    default:
      return `/${slug}`
  }
}

interface AppShellProps {
  session: AppShellSession
  /** Navigation items specific to the current app */
  navItems?: AppShellNavItem[]
  /** All org memberships for the switcher */
  memberships?: OrgMembership[]
  children: React.ReactNode
}

/**
 * Shared shell component used by all authenticated apps.
 * Provides sidebar navigation, org switcher, and user menu.
 *
 * Each app provides its own `navItems`. The shell adds the
 * org switcher and account/logout links automatically.
 */
export function AppShell({
  session,
  navItems = [],
  memberships = [],
  children,
}: AppShellProps) {
  const displayName = session.user.displayName || session.user.email

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r p-4 md:block">
        <div className="mb-6 text-sm font-medium">Eleva</div>

        {/* App-specific navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Org switcher */}
        {memberships.length > 1 && (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
              Organizations
            </p>
            <nav className="space-y-1">
              {memberships.map((m) => (
                <a
                  key={m.orgSlug}
                  href={orgHomeUrl(m)}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    m.orgSlug === session.orgSlug
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {m.orgName || m.orgSlug}
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* User menu */}
        <div className="mt-6 space-y-1 border-t pt-4">
          <a
            href={`${ACCOUNT_URL}/profile`}
            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50"
          >
            {displayName}
          </a>
          <a
            href={`${ACCOUNT_URL}/organizations`}
            className="block rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            Manage organizations
          </a>
          <form action="/logout" method="POST">
            <button
              className="block w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
