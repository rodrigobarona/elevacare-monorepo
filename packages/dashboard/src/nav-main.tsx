"use client"

import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@eleva/ui/components/sidebar"
import type { NavGroup } from "./nav-types"
import { NavMenuItemLink } from "./nav-menu-item-link"

interface NavMainProps {
  groups: NavGroup[]
  capabilities?: readonly string[]
}

export function NavMain({ groups, capabilities = [] }: NavMainProps) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group, idx) => {
        const visibleItems = group.items.filter(
          (item) => !item.needs || capabilities.includes(item.needs)
        )

        if (visibleItems.length === 0) return null

        return (
          <SidebarGroup key={group.label ?? idx}>
            {group.label && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.url ||
                    (item.url !== "/" && pathname.startsWith(item.url + "/"))

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <NavMenuItemLink
                          href={item.url}
                          title={item.title}
                          icon={item.icon}
                          active={isActive}
                          shortcut={item.shortcut}
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
