"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Globe, LogOut, User, Settings } from "lucide-react"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import type { DashboardUser } from "./nav-types"

interface NavUserProps {
  user: DashboardUser
  accountUrl?: string
  settingsUrl?: string
  homepageUrl?: string
  logoutUrl?: string
}

function deriveParentPath(url: string): string {
  const lastSlash = url.lastIndexOf("/")
  return lastSlash > 0 ? url.slice(0, lastSlash) : "/"
}

export function NavUser({
  user,
  accountUrl = "/account/profile",
  settingsUrl,
  homepageUrl,
  logoutUrl = "/logout",
}: NavUserProps) {
  const t = useTranslations("shell")
  const displayName = user.displayName || user.email.split("@")[0] || ""
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-7">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={displayName} />
              )}
              <AvatarFallback className="rounded-lg text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={accountUrl}>
              <User className="mr-2 size-4" />
              {t("profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={settingsUrl ?? deriveParentPath(accountUrl)}>
              <Settings className="mr-2 size-4" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {homepageUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={homepageUrl}>
                <Globe className="mr-2 size-4" />
                {t("homepage")}
              </a>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={logoutUrl}>
            <LogOut className="mr-2 size-4" />
            {t("signOut")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
