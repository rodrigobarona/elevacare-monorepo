"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@eleva/ui/components/sidebar"
import { OrgSwitcherWidget } from "./org-switcher-widget"
import { NavMain } from "./nav-main"
import type { NavGroup } from "./nav-types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  homeUrl?: string
  navGroups: NavGroup[]
  capabilities?: readonly string[]
  widgetToken?: string | null
}

export function AppSidebar({
  homeUrl = "/",
  navGroups,
  capabilities,
  widgetToken,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-2">
        {widgetToken ? (
          <OrgSwitcherWidget authToken={widgetToken} />
        ) : (
          <div className="px-2 py-1.5 text-sm font-semibold">Eleva</div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} capabilities={capabilities} />
      </SidebarContent>
    </Sidebar>
  )
}
