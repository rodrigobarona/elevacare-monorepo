"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { LayoutDashboard, LogOut } from "@eleva/icons"

interface UserMenuProps {
  initials: string
  firstName: string | null
  email: string
  avatarUrl: string | null
  dashboardLabel: string
  signOutLabel: string
  dashboardUrl: string
  signOutUrl: string
}

/**
 * Menu items use plain `href`s. `apps/web` does not mount a React Aria
 * `RouterProvider`, so these render as native anchors and the browser does a
 * full navigation — required for the gateway to rewrite into the account zone.
 */
export function UserMenu({
  initials,
  firstName,
  email,
  avatarUrl,
  dashboardLabel,
  signOutLabel,
  dashboardUrl,
  signOutUrl,
}: UserMenuProps) {
  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label={firstName ?? email}
        className="rounded-full"
      >
        <Avatar className="size-8">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={firstName ?? email} />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenu placement="bottom end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{firstName ?? email}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="dashboard"
          href={dashboardUrl}
          textValue={dashboardLabel}
        >
          <LayoutDashboard />
          {dashboardLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="sign-out"
          href={signOutUrl}
          textValue={signOutLabel}
        >
          <LogOut />
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
