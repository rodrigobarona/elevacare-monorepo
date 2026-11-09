"use client"

import { useTranslations } from "next-intl"
import {
  useConsentAvailable,
  useOpenCookieSettings,
} from "@eleva/consent/open-cookie-settings"
import {
  ArrowSquareOutIcon,
  ArrowsLeftRightIcon,
  BuildingsIcon,
  CookieIcon,
  GearIcon,
  GlobeIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HouseIcon,
  QuestionIcon,
  ShieldCheckIcon,
  SignOutIcon,
  StethoscopeIcon,
  type Icon,
} from "@eleva/icons"
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
import { cn } from "@eleva/ui/lib/utils"
import type {
  AccountMenuModel,
  AccountMenuShortcut,
  WorkspaceKind,
} from "./account-menu-model"
import type { DashboardUser } from "./nav-types"
import { NavThemeMenu } from "./nav-theme-menu"

/** Every row the same height (44px on touch screens), one icon slot. */
const ROW = "min-h-10 pointer-coarse:min-h-11"
const ICON = "size-4 text-muted-foreground"

const KIND_ICON: Record<WorkspaceKind, Icon> = {
  expert: StethoscopeIcon,
  team: BuildingsIcon,
  academy: GraduationCapIcon,
}

interface AccountMenuProps {
  user: DashboardUser
  menu: AccountMenuModel
  /**
   * "site" is the public website: no appearance switch (it has one look)
   * and no link to the home page you are already on.
   */
  surface?: "dashboard" | "site"
}

function RowText({ title, hint }: { title: string; hint?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{title}</span>
      {hint ? (
        <span className="truncate text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </span>
  )
}

function ShortcutItem({ shortcut }: { shortcut: AccountMenuShortcut }) {
  const t = useTranslations("accountMenu")
  switch (shortcut.kind) {
    case "space":
      return (
        <DropdownMenuItem
          id="space"
          href={shortcut.href}
          textValue={t("yourSpace")}
          className={ROW}
        >
          <HouseIcon className={ICON} />
          {t("yourSpace")}
        </DropdownMenuItem>
      )
    case "workspace": {
      const KindIcon = KIND_ICON[shortcut.workspaceKind]
      return (
        <DropdownMenuItem
          id={`workspace-${shortcut.href}`}
          href={shortcut.href}
          textValue={shortcut.name}
          className={ROW}
        >
          <KindIcon className={ICON} />
          <RowText
            title={shortcut.name}
            hint={t(`kind.${shortcut.workspaceKind}`)}
          />
        </DropdownMenuItem>
      )
    }
    case "switch":
      return (
        <DropdownMenuItem
          id="switch"
          href={shortcut.href}
          textValue={t("switchWorkspace")}
          className={ROW}
        >
          <ArrowsLeftRightIcon className={ICON} />
          <span className="flex-1">{t("switchWorkspace")}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {shortcut.count}
          </span>
        </DropdownMenuItem>
      )
    case "offer":
      return (
        <DropdownMenuItem
          id="offer"
          href={shortcut.href}
          textValue={t("offerSessions")}
          className={cn(ROW, "bg-accent/60 text-accent-foreground")}
        >
          <HandHeartIcon className="size-4 text-primary" />
          <RowText title={t("offerSessions")} hint={t("offerSessionsHint")} />
        </DropdownMenuItem>
      )
  }
}

/** Rendered only under the consent shell; c15t hooks need its provider. */
function CookiePreferencesItem() {
  const t = useTranslations("accountMenu")
  const openCookieSettings = useOpenCookieSettings()
  if (!openCookieSettings) return null
  return (
    <DropdownMenuItem
      id="cookies"
      textValue={t("cookiePreferences")}
      onAction={openCookieSettings}
      className={ROW}
    >
      <CookieIcon className={ICON} />
      {t("cookiePreferences")}
    </DropdownMenuItem>
  )
}

/**
 * The one avatar menu for every signed-in app and the public website.
 * Rows come from {@link AccountMenuModel}, built on the server.
 */
export function AccountMenu({
  user,
  menu,
  surface = "dashboard",
}: AccountMenuProps) {
  const t = useTranslations("accountMenu")
  const consentAvailable = useConsentAvailable()
  const displayName = user.displayName || user.email.split("@")[0] || ""
  const avatarSeed = getAvatarSeed(user.email, displayName)
  const initials = getAvatarInitials(displayName, user.email)
  const fallbackStyle = getAvatarFallbackStyle(avatarSeed)

  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("yourAccount")}
        className="rounded-full"
        data-testid="account-menu-trigger"
      >
        <Avatar key={user.avatarUrl ?? "fallback"} className="size-8">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback
            className="text-xs font-semibold text-white"
            style={fallbackStyle}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </Button>
      <DropdownMenu
        className="w-72 p-1.5"
        placement="bottom end"
        data-testid="account-menu"
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar key={user.avatarUrl ?? "fallback-menu"} className="size-9">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={fallbackStyle}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-sm leading-tight">
              <span className="truncate font-medium text-foreground">
                {displayName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        {menu.shortcuts.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-label={t("workspacesGroup")}>
              {menu.shortcuts.map((shortcut) => (
                <ShortcutItem
                  key={
                    shortcut.kind === "workspace"
                      ? shortcut.href
                      : shortcut.kind
                  }
                  shortcut={shortcut}
                />
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}

        {menu.staffHref ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              id="staff"
              href={menu.staffHref}
              target="_blank"
              rel="noopener"
              textValue={t("staff")}
              className={ROW}
            >
              <ShieldCheckIcon className={ICON} />
              <RowText title={t("staff")} hint={t("staffHint")} />
              <ArrowSquareOutIcon className={ICON} />
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label={t("settingsGroup")}>
          <DropdownMenuItem
            id="account"
            href={menu.accountHref}
            textValue={t("accountSettings")}
            className={ROW}
          >
            <GearIcon className={ICON} />
            {t("accountSettings")}
          </DropdownMenuItem>
          {surface === "dashboard" ? <NavThemeMenu className={ROW} /> : null}
          {consentAvailable ? <CookiePreferencesItem /> : null}
          <DropdownMenuItem
            id="help"
            href={menu.helpHref}
            textValue={t("help")}
            className={ROW}
          >
            <QuestionIcon className={ICON} />
            {t("help")}
          </DropdownMenuItem>
          {surface === "dashboard" ? (
            <DropdownMenuItem
              id="home"
              href={menu.homeHref}
              textValue={t("homePage")}
              className={ROW}
            >
              <GlobeIcon className={ICON} />
              {t("homePage")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          id="sign-out"
          href={menu.logoutHref}
          textValue={t("signOut")}
          className={ROW}
        >
          <SignOutIcon className={ICON} />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
