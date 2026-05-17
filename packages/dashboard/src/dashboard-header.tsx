import { Separator } from "@eleva/ui/components/separator"
import { SidebarTrigger } from "@eleva/ui/components/sidebar"
import { NavUser } from "./nav-user"
import { OrgSwitcherWidget } from "./org-switcher-widget"
import type { DashboardUser } from "./nav-types"

interface DashboardHeaderProps {
  user: DashboardUser
  widgetToken?: string | null
  accountUrl?: string
  logoutUrl?: string
  children?: React.ReactNode
}

export function DashboardHeader({
  user,
  widgetToken,
  accountUrl,
  logoutUrl,
  children,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      {widgetToken ? (
        <OrgSwitcherWidget authToken={widgetToken} />
      ) : (
        <div className="text-sm font-medium">Eleva</div>
      )}
      {children && (
        <>
          <Separator orientation="vertical" className="h-4" />
          {children}
        </>
      )}
      <div className="ml-auto flex items-center gap-1">
        <NavUser user={user} accountUrl={accountUrl} logoutUrl={logoutUrl} />
      </div>
    </header>
  )
}
