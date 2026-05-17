"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@eleva/ui/components/sidebar"
import type { NavGroup } from "./nav-types"

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
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.url ||
                        (item.url !== "/" &&
                          pathname.startsWith(item.url + "/"))
                      }
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        {item.icon}
                        <span>{item.title}</span>
                        {item.shortcut && (
                          <kbd className="ml-auto hidden text-[10px] font-medium text-muted-foreground/70 lg:inline-block">
                            {item.shortcut}
                          </kbd>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}
