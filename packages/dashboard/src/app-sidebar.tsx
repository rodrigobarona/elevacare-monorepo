"use client"

import Link from "next/link"
import { PanelLeftIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@eleva/ui/components/sidebar"
import { Button } from "@eleva/ui/components/button"
import { NavMain } from "./nav-main"
import type { NavGroup } from "./nav-types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  homeUrl?: string
  navGroups: NavGroup[]
  capabilities?: readonly string[]
}

function SidebarHeaderContent({ homeUrl }: { homeUrl: string }) {
  const { toggleSidebar } = useSidebar()

  return (
    <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-2">
      <div className="flex items-center justify-between">
        <Link
          href={homeUrl}
          className="flex items-center px-2 py-1.5 text-sm font-semibold group-data-[collapsible=icon]:hidden"
        >
          Eleva
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="size-7 shrink-0"
        >
          <PanelLeftIcon />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </div>
    </SidebarHeader>
  )
}

export function AppSidebar({
  homeUrl = "/",
  navGroups,
  capabilities,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeaderContent homeUrl={homeUrl} />
      <SidebarContent>
        <NavMain groups={navGroups} capabilities={capabilities} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
