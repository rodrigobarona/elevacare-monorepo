"use client"

import { LogOut, LayoutDashboard, Settings } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@eleva/ui/components/button"
import { Avatar, AvatarFallback } from "@eleva/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"

interface UserMenuProps {
  name: string
  email: string
  initials: string
}

export function UserMenu({ name, email, initials }: UserMenuProps) {
  const t = useTranslations("nav")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm leading-none font-medium">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/auth-redirect">
            <LayoutDashboard />
            {t("dashboard")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings">
            <Settings />
            {t("settings")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/logout">
            <LogOut />
            {t("signout")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
