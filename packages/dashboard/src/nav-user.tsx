"use client"

import { useTranslations } from "next-intl"
import { GlobeIcon, SignOutIcon, UserIcon, GearIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
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
    <DropdownMenuTrigger>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Avatar key={user.avatarUrl ?? "fallback"} className="size-7">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback
            className="text-[10px] font-semibold text-white"
            style={fallbackStyle}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenu className="min-w-56 rounded-lg p-1" placement="bottom end">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1 text-left text-sm">
            <Avatar key={user.avatarUrl ?? "fallback-menu"} className="size-8">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback
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
          <DropdownMenuItem
            href={accountUrl}
            textValue={t("profile")}
            className="py-1"
          >
            <UserIcon className="size-4" />
            {t("profile")}
          </DropdownMenuItem>
          <DropdownMenuItem
            href={settingsUrl ?? deriveParentPath(accountUrl)}
            textValue={t("settings")}
            className="py-1"
          >
            <GearIcon className="size-4" />
            {t("settings")}
          </DropdownMenuItem>
          <NavThemeMenu />
          {homepageUrl && (
            <DropdownMenuItem
              href={homepageUrl}
              textValue={t("homepage")}
              className="py-1"
            >
              <GlobeIcon className="size-4" />
              {t("homepage")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          href={logoutUrl}
          textValue={t("signOut")}
          className="py-1"
        >
          <SignOutIcon className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
