"use client"

import * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { Avatar, AvatarFallback } from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import { CaretDownIcon } from "@eleva/icons"
import { OrgTypeBadge } from "./org-type-badge"
import type { OrgSwitcherItem } from "./nav-types"

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

interface OrgSwitcherTriggerProps {
  organization: OrgSwitcherItem
  homeUrl: string
  open: boolean
  className?: string
}

/**
 * Sidebar org row: the name links to the org home, the caret opens the
 * switcher popover. The caret is a React Aria `Button` so the surrounding
 * `PopoverTrigger` can wire press + anchoring through context.
 */
export function OrgSwitcherTrigger({
  organization,
  homeUrl,
  open,
  className,
}: OrgSwitcherTriggerProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-full min-w-0 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-sidebar-accent",
        open && "bg-sidebar-accent",
        className
      )}
    >
      <a
        href={homeUrl}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        <Avatar className="size-6 shrink-0">
          <AvatarFallback className="bg-sidebar-accent text-[10px] font-medium text-sidebar-foreground">
            {orgInitials(organization.name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
          {organization.name}
        </span>
        <OrgTypeBadge orgType={organization.orgType} />
      </a>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Open organization menu"
        className="shrink-0 rounded-sm text-sidebar-foreground/70 hover:bg-transparent hover:text-sidebar-foreground"
      >
        <CaretDownIcon className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
