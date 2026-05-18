import { Separator } from "@eleva/ui/components/separator"
import { SidebarTrigger } from "@eleva/ui/components/sidebar"
import { NavUser } from "./nav-user"
import type { DashboardUser } from "./nav-types"

interface DashboardHeaderProps {
  user: DashboardUser
  accountUrl?: string
  settingsUrl?: string
  homepageUrl?: string
  logoutUrl?: string
  children?: React.ReactNode
}

export function DashboardHeader({
  user,
  accountUrl,
  settingsUrl,
  homepageUrl,
  logoutUrl,
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
