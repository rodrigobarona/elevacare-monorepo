"use client"

import { cn } from "@eleva/ui/lib/utils"
import { Badge } from "@eleva/ui/components/badge"
import { useTranslations } from "next-intl"
import type { OrgSwitcherItem } from "./nav-types"

type OrgTypeKey = OrgSwitcherItem["orgType"]

const badgeStyles: Record<string, string> = {
  personal: "border-border bg-muted/60 text-muted-foreground",
  expert: "border-primary/30 bg-accent text-accent-foreground",
  team: "border-secondary-foreground/20 bg-secondary text-secondary-foreground",
  academy: "border-info/30 bg-info-subtle text-info",
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
