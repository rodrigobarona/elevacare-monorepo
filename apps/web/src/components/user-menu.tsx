"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { LayoutDashboard, LogOut } from "lucide-react"

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
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={firstName ?? email} />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{firstName ?? email}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={dashboardUrl}>
            <LayoutDashboard />
            {dashboardLabel}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={signOutUrl}>
            <LogOut />
            {signOutLabel}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
