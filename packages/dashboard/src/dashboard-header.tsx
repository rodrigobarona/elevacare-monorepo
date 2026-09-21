import { Separator } from "@eleva/ui/components/separator"
import { SidebarTrigger } from "@eleva/ui/components/sidebar"
import { NavBell } from "./nav-bell"
import { NavUser } from "./nav-user"
import type { DashboardUser } from "./nav-types"

interface DashboardHeaderProps {
  user: DashboardUser
  accountUrl?: string
  settingsUrl?: string
  homepageUrl?: string
  logoutUrl?: string
  inboxUrl?: string
  apiBaseUrl?: string
  children?: React.ReactNode
}

export function DashboardHeader({
  user,
  accountUrl,
  settingsUrl,
  homepageUrl,
  logoutUrl,
  inboxUrl,
  apiBaseUrl,
  children,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      {children && (
        <>
          <Separator orientation="vertical" className="h-4" />
          {children}
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        {inboxUrl && apiBaseUrl ? (
          <NavBell inboxUrl={inboxUrl} apiBaseUrl={apiBaseUrl} />
        ) : null}
        <NavUser
          user={user}
          accountUrl={accountUrl}
          settingsUrl={settingsUrl}
          homepageUrl={homepageUrl}
          logoutUrl={logoutUrl}
        />
      </div>
    </header>
  )
}
