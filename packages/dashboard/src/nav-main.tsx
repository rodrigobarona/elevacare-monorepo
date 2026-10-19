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
import { NavMenuItemContent } from "./nav-menu-item-content"

interface NavMainProps {
  groups: NavGroup[]
  capabilities?: readonly string[]
}

function matchesPath(pathname: string, url: string): boolean {
  return pathname === url || (url !== "/" && pathname.startsWith(url + "/"))
}

/** Longest matching item URL, so a Space home link is not active on its sub-pages. */
function activeNavUrl(
  pathname: string,
  groups: NavGroup[],
  capabilities: readonly string[]
): string | null {
  let best: string | null = null
  for (const group of groups) {
    for (const item of group.items) {
      if (item.needs && !capabilities.includes(item.needs)) continue
      if (!matchesPath(pathname, item.url)) continue
      if (best === null || item.url.length > best.length) best = item.url
    }
  }
  return best
}

export function NavMain({ groups, capabilities = [] }: NavMainProps) {
  const pathname = usePathname()
  const activeUrl = activeNavUrl(pathname, groups, capabilities)

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
                  const isActive = item.url === activeUrl

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        href={item.url}
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        {({ isHovered, isFocusVisible }) => (
                          <NavMenuItemContent
                            title={item.title}
                            icon={item.icon}
                            active={isActive}
                            hovered={isHovered || isFocusVisible}
                            shortcut={item.shortcut}
                          />
                        )}
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
