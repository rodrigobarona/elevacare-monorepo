"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowLeft } from "lucide-react"
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
  const t = useTranslations("shell")

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-2">
        {widgetToken ? (
          <OrgSwitcherWidget authToken={widgetToken} />
        ) : (
          <Link
            href={homeUrl}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ArrowLeft className="size-4" />
            <span>{t("back")}</span>
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} capabilities={capabilities} />
      </SidebarContent>
    </Sidebar>
  )
}
