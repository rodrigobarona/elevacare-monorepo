"use client"

import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "@eleva/icons"
import { Logo } from "@eleva/ui/components/brand"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@eleva/ui/components/sidebar"
import { gatewayUrl } from "./gateway-url"
import { OrgSwitcher } from "./org-switcher"
import { NavMain } from "./nav-main"
import type { NavGroup, OrgSwitcherItem } from "./nav-types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  homeUrl?: string
  navGroups: NavGroup[]
  capabilities?: readonly string[]
  organizations?: OrgSwitcherItem[]
}

export function AppSidebar({
  homeUrl = "/",
  navGroups,
  capabilities,
  organizations,
  ...props
}: AppSidebarProps) {
  const t = useTranslations("shell")

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-2">
        {organizations && organizations.length > 0 ? (
          <OrgSwitcher organizations={organizations} />
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
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <a
          href={gatewayUrl("/dashboard")}
          className="w-fit rounded-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          <Logo className="h-5 text-current" />
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}
