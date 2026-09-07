"use client"

import type { NavIconName } from "@eleva/icons"
import { getNavIcon, NavIcon } from "@eleva/icons/client"

interface NavMenuItemContentProps {
  title: string
  icon: NavIconName
  active: boolean
  /** Hover / focus-visible state, supplied by the parent's React Aria render props. */
  hovered: boolean
  shortcut?: string
}

/**
 * Inner content of a sidebar nav link. The anchor itself is rendered by
 * `SidebarMenuButton href=…` (React Aria `Link`); this component only owns the
 * icon-weight morph and label so it can read `isHovered` / `isFocusVisible`
 * from the link's render props.
 */
export function NavMenuItemContent({
  title,
  icon,
  active,
  hovered,
  shortcut,
}: NavMenuItemContentProps) {
  const IconComponent = getNavIcon(icon)

  return (
    <>
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
    </>
  )
}
