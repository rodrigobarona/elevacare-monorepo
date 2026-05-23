"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { GlobeIcon, SignOutIcon, UserIcon, GearIcon } from "@eleva/icons"
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
import {
  getAvatarFallbackStyle,
  getAvatarInitials,
  getAvatarSeed,
} from "@eleva/ui/lib/avatar-utils"
import type { DashboardUser } from "./nav-types"
import { gatewayUrl } from "./gateway-url"
import { NavThemeMenu } from "./nav-theme-menu"

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
  accountUrl = gatewayUrl("/account/settings"),
  settingsUrl,
  homepageUrl,
  logoutUrl = gatewayUrl("/logout"),
}: NavUserProps) {
  const t = useTranslations("shell")
  const displayName = user.displayName || user.email.split("@")[0] || ""
  const avatarSeed = getAvatarSeed(user.email, displayName)
  const initials = getAvatarInitials(displayName, user.email)
  const fallbackStyle = getAvatarFallbackStyle(avatarSeed)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar key={user.avatarUrl ?? "fallback"} className="size-7">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback
              delayMs={0}
              className="text-[10px] font-semibold text-white"
              style={fallbackStyle}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg p-1" align="end">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1 text-left text-sm">
            <Avatar key={user.avatarUrl ?? "fallback-menu"} className="size-8">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback
                delayMs={0}
                className="text-xs font-semibold text-white"
                style={fallbackStyle}
              >
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
        <DropdownMenuGroup className="p-0">
          <DropdownMenuItem asChild className="py-1">
            <Link href={accountUrl}>
              <UserIcon className="size-4" />
              {t("profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="py-1">
            <Link href={settingsUrl ?? deriveParentPath(accountUrl)}>
              <GearIcon className="size-4" />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
          <NavThemeMenu />
          {homepageUrl && (
            <DropdownMenuItem asChild className="py-1">
              <a href={homepageUrl}>
                <GlobeIcon className="size-4" />
                {t("homepage")}
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="py-1">
          <a href={logoutUrl}>
            <SignOutIcon className="size-4" />
            {t("signOut")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
