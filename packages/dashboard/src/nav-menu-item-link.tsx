"use client"

import Link from "next/link"
import { forwardRef, useState, type ComponentPropsWithoutRef } from "react"
import type { NavIconName } from "@eleva/icons"
import { getNavIcon, NavIcon } from "@eleva/icons/client"

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

interface NavMenuItemLinkProps extends Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "children"
> {
  title: string
  icon: NavIconName
  active: boolean
  shortcut?: string
}

/**
 * Sidebar nav link — must forward ref/className for SidebarMenuButton asChild.
 */
export const NavMenuItemLink = forwardRef<
  HTMLAnchorElement,
  NavMenuItemLinkProps
>(function NavMenuItemLink(
  {
    href,
    title,
    icon,
    active,
    shortcut,
    className,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const [hovered, setHovered] = useState(false)
  const IconComponent = getNavIcon(icon)

  return (
    <Link
      ref={ref}
      href={href}
      className={cn(className)}
      {...props}
      onPointerEnter={(event) => {
        setHovered(true)
        onPointerEnter?.(event)
      }}
      onPointerLeave={(event) => {
        setHovered(false)
        onPointerLeave?.(event)
      }}
      onFocus={(event) => {
        setHovered(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setHovered(false)
        onBlur?.(event)
      }}
    >
      <NavIcon
        icon={IconComponent}
        active={active}
        hovered={hovered}
        size={16}
        className={
          active
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/70 group-hover/menu-button:text-sidebar-foreground"
        }
      />
      <span className="truncate">{title}</span>
      {shortcut && (
        <kbd className="ml-auto hidden text-[10px] font-medium text-muted-foreground/70 lg:inline-block">
          {shortcut}
        </kbd>
      )}
    </Link>
  )
})
