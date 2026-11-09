import { LogoMark } from "@eleva/ui/components/brand"
import { Separator } from "@eleva/ui/components/separator"
import { SidebarTrigger } from "@eleva/ui/components/sidebar"
import { NavBell } from "./nav-bell"
import { AccountMenu } from "./account-menu"
import type { AccountMenuModel } from "./account-menu-model"
import type { DashboardUser } from "./nav-types"

interface DashboardHeaderProps {
  user: DashboardUser
  accountMenu: AccountMenuModel
  inboxUrl?: string
  apiBaseUrl?: string
  children?: React.ReactNode
}

export function DashboardHeader({
  user,
  accountMenu,
  inboxUrl,
  apiBaseUrl,
  children,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="md:hidden" />
      <LogoMark title="" className="size-6 md:hidden" />
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
        <AccountMenu user={user} menu={accountMenu} />
      </div>
    </header>
  )
}
