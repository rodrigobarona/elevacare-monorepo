"use client"

import * as React from "react"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { useTranslations } from "next-intl"
import { Popover, PopoverTrigger } from "@eleva/ui/components/popover"
import { CreateWorkspaceModal } from "./create-workspace-modal"
import { OrgSwitcherList } from "./org-switcher-list"
import { OrgSwitcherTrigger } from "./org-switcher-trigger"
import { resolveOrgHomeUrl } from "./resolve-org-home-url"
import { switchOrganization } from "./switch-org-action"
import type { OrgSwitcherItem } from "./nav-types"

interface OrgSwitcherProps {
  organizations: OrgSwitcherItem[]
}

export function OrgSwitcher({ organizations }: OrgSwitcherProps) {
  const t = useTranslations("shell")
  const [open, setOpen] = React.useState(false)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = React.useState(false)
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)

  const current = organizations.find((org) => org.isCurrent) ?? organizations[0]

  if (!current) return null

  const currentHomeUrl = resolveOrgHomeUrl({
    orgSlug: current.orgSlug,
    productLabel: current.productLabel,
    orgType: current.orgType,
  })

  const handleSwitch = async (organization: OrgSwitcherItem) => {
    if (organization.isCurrent) {
      setOpen(false)
      return
    }

    setSwitchingId(organization.orgId)
    let redirecting = false
    try {
      const homeUrl = resolveOrgHomeUrl({
        orgSlug: organization.orgSlug,
        productLabel: organization.productLabel,
        orgType: organization.orgType,
      })
      await switchOrganization(organization.orgId, homeUrl)
    } catch (err) {
      if (isRedirectError(err)) {
        redirecting = true
        throw err
      }
      console.error(t("orgSwitchError"), err)
    } finally {
      if (!redirecting) {
        setSwitchingId(null)
      }
    }
  }

  return (
    <>
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <OrgSwitcherTrigger
          organization={current}
          homeUrl={currentHomeUrl}
          open={open}
        />
        <Popover
          placement="bottom start"
          offset={6}
          className="w-80 min-w-80 gap-0 rounded-lg! border border-border bg-popover p-0 shadow-md"
        >
          <OrgSwitcherList
            organizations={organizations}
            onSwitch={handleSwitch}
            switchingId={switchingId}
            onCreateWorkspace={() => {
              setOpen(false)
              setCreateWorkspaceOpen(true)
            }}
          />
        </Popover>
      </PopoverTrigger>
      <CreateWorkspaceModal
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
      />
    </>
  )
}
