"use client"

import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "@eleva/icons"
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
          <a
            href={homeUrl}
            className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-normal text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:bg-sidebar-accent focus-visible:text-sidebar-foreground"
          >
            <ArrowLeftIcon className="size-4 shrink-0" />
            <span>{t("back")}</span>
          </a>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} capabilities={capabilities} />
      </SidebarContent>
    </Sidebar>
  )
}
