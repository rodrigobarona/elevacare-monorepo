"use client"

import { cn } from "@eleva/ui/lib/utils"
import { Badge } from "@eleva/ui/components/badge"
import { useTranslations } from "next-intl"
import type { OrgSwitcherItem } from "./nav-types"

type OrgTypeKey = OrgSwitcherItem["orgType"]

const badgeStyles: Record<string, string> = {
  personal: "border-border bg-muted/60 text-muted-foreground",
  expert:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  team: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  academy:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  staff: "border-border bg-muted/60 text-muted-foreground",
}

const badgeLabelKeys: Record<string, string> = {
  personal: "badgePersonal",
  expert: "badgeExpert",
  team: "badgeTeam",
  academy: "badgeAcademy",
  staff: "badgeStaff",
}

export function getOrgTypeBadgeLabel(
  orgType: string,
  t: (key: string) => string
): string {
  const key = badgeLabelKeys[orgType]
  return key ? t(key) : orgType
}

interface OrgTypeBadgeProps {
  orgType: OrgTypeKey
  className?: string
}

export function OrgTypeBadge({ orgType, className }: OrgTypeBadgeProps) {
  const t = useTranslations("orgSwitcher")
  const label = getOrgTypeBadgeLabel(orgType, t)

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-md px-1.5 text-[10px] font-medium tracking-wide uppercase",
        badgeStyles[orgType] ?? badgeStyles.personal,
        className
      )}
    >
      {label}
    </Badge>
  )
}
