"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { cn } from "@eleva/ui/lib/utils"
import { Avatar, AvatarFallback } from "@eleva/ui/components/avatar"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@eleva/ui/components/command"
import { CheckIcon, PlusIcon } from "@eleva/icons"
import { getOrgTypeBadgeLabel, OrgTypeBadge } from "./org-type-badge"
import type { OrgSwitcherItem } from "./nav-types"

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

function orgSwitcherFilter(value: string, search: string): number {
  if (!search) return 1
  const haystack = value.toLowerCase()
  const needle = search.toLowerCase().trim()
  return haystack.includes(needle) ? 1 : 0
}

function orgSearchValue(org: OrgSwitcherItem, badgeLabel: string): string {
  return [org.name, org.orgSlug, badgeLabel].filter(Boolean).join(" ")
}

interface OrgSwitcherListProps {
  organizations: OrgSwitcherItem[]
  onSwitch: (organization: OrgSwitcherItem) => void
  onCreateWorkspace: () => void
  switchingId?: string | null
}

export function OrgSwitcherList({
  organizations,
  onSwitch,
  onCreateWorkspace,
  switchingId,
}: OrgSwitcherListProps) {
  const t = useTranslations("orgSwitcher")

  return (
    <div className="flex flex-col bg-popover">
      <Command
        filter={orgSwitcherFilter}
        className="gap-0 rounded-none bg-popover p-0 [&_[data-slot=command-item][data-selected=true]]:bg-accent/40"
      >
        <CommandInput variant="plain" placeholder={t("findWorkspace")} />
        <CommandList className="max-h-72 p-1">
          <CommandEmpty className="py-8 text-muted-foreground">
            {t("noResults")}
          </CommandEmpty>
          {organizations.map((org) => {
            const badgeLabel = getOrgTypeBadgeLabel(org.orgType, t)
            return (
              <CommandItem
                key={org.workosOrgId}
                value={orgSearchValue(org, badgeLabel)}
                disabled={switchingId === org.workosOrgId}
                onSelect={() => onSwitch(org)}
                className="gap-2 rounded-md px-2.5 py-2 data-selected:bg-accent/40 [&>svg.ml-auto]:hidden"
              >
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="border border-border/60 bg-background text-[10px] font-medium text-foreground">
                    {orgInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{org.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {org.orgSlug}
                  </div>
                </div>
                <OrgTypeBadge orgType={org.orgType} />
                {org.isCurrent ? (
                  <CheckIcon className="size-4 shrink-0 text-foreground" />
                ) : null}
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
      <div className="border-t border-border p-1.5">
        <button
          type="button"
          onClick={onCreateWorkspace}
          className={cn(
            "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
          )}
        >
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground">
            <PlusIcon className="size-4" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-medium">
              {t("createWorkspace")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("createWorkspaceDescription")}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
