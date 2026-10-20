"use client"

import * as React from "react"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { MembershipRole, OrgType } from "@eleva/auth/types"
import { OrgTypeBadge } from "@eleva/dashboard/org-type-badge"
import { switchOrganization } from "@eleva/dashboard/switch-org-action"
import { Button } from "@eleva/ui/components/button"
import { StatusPill } from "@eleva/ui/components/status-pill"

export interface WorkspaceRow {
  orgId: string
  orgSlug: string
  orgType: OrgType
  name: string
  membershipRole: MembershipRole
  isCurrent: boolean
  homeUrl: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function WorkspaceList({ rows }: { rows: WorkspaceRow[] }) {
  const t = useTranslations("organizations")
  const [openingId, setOpeningId] = React.useState<string | null>(null)

  async function open(row: WorkspaceRow) {
    setOpeningId(row.orgId)
    try {
      await switchOrganization(row.orgId, row.homeUrl)
    } catch (err) {
      if (isRedirectError(err)) throw err
      console.error("[account/workspaces] switch failed", err)
      toast.error(t("openFailed"))
      setOpeningId(null)
    }
  }

  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li
          key={row.orgId}
          className="flex flex-wrap items-center gap-4 rounded-3xl border bg-card p-4 shadow-1 sm:p-5"
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-sm font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200"
          >
            {initials(row.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-medium">{row.name}</h3>
              <OrgTypeBadge orgType={row.orgType} />
              {row.isCurrent ? (
                <StatusPill tone="positive">{t("current")}</StatusPill>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {t(`role.${row.membershipRole}`)} · {row.orgSlug}
            </p>
          </div>
          <Button
            size="sm"
            variant={row.isCurrent ? "default" : "outline"}
            isDisabled={openingId !== null}
            onPress={() => void open(row)}
            aria-label={t("openNamed", { name: row.name })}
          >
            {openingId === row.orgId ? t("opening") : t("open")}
          </Button>
        </li>
      ))}
    </ul>
  )
}
