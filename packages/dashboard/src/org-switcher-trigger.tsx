"use client"

import * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { Avatar, AvatarFallback } from "@eleva/ui/components/avatar"
import { CaretDownIcon } from "@eleva/icons"
import { OrgTypeBadge } from "./org-type-badge"
import type { OrgSwitcherItem } from "./nav-types"

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

interface OrgSwitcherTriggerProps extends React.ComponentPropsWithoutRef<"button"> {
  organization: OrgSwitcherItem
  homeUrl: string
  open: boolean
}

export const OrgSwitcherTrigger = React.forwardRef<
  HTMLButtonElement,
  OrgSwitcherTriggerProps
>(function OrgSwitcherTrigger(
  { organization, homeUrl, open, className, ...props },
  ref
) {
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
      <button
        ref={ref}
        type="button"
        className="flex shrink-0 cursor-pointer items-center rounded-sm p-1 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        {...props}
      >
        <CaretDownIcon
          className="size-4 text-sidebar-foreground/70"
          aria-hidden
        />
      </button>
    </div>
  )
})
