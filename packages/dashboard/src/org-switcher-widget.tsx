"use client"

import "@workos-inc/widgets/styles.css"
import "./org-switcher-widget.css"
import { WorkOsWidgets, OrganizationSwitcher } from "@workos-inc/widgets"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { switchOrganization } from "./switch-org-action"

interface OrgSwitcherWidgetProps {
  authToken: string
  onSwitch?: (params: { organizationId: string }) => Promise<void>
}

export function OrgSwitcherWidget({
  authToken,
  onSwitch,
}: OrgSwitcherWidgetProps) {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()

  const handleSwitch = async ({
    organizationId,
  }: {
    organizationId: string
  }) => {
    if (onSwitch) {
      await onSwitch({ organizationId })
      return
    }

    try {
      const { redirectUrl } = await switchOrganization(organizationId, pathname)
      window.location.href = redirectUrl
    } catch (err) {
      console.error("Error switching organization:", err)
    }
  }

  return (
    <div className="eleva-org-switcher w-full">
      <WorkOsWidgets
        theme={{
          appearance: resolvedTheme === "dark" ? "dark" : "light",
          accentColor: "teal",
          radius: "medium",
          fontFamily: "inherit",
        }}
      >
        <OrganizationSwitcher
          authToken={authToken}
          switchToOrganization={handleSwitch}
          variant="outline"
        />
      </WorkOsWidgets>
    </div>
  )
}
