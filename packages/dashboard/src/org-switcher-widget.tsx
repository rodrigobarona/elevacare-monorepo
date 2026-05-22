"use client"

import "@workos-inc/widgets/styles.css"
import "@eleva/dashboard/workos-widgets-overrides.css"
import "./org-switcher-widget.css"
import { WorkOsWidgets, OrganizationSwitcher } from "@workos-inc/widgets"
import * as React from "react"
import { WorkOsLocaleProvider } from "@workos-inc/widgets-i18n"
import { resolveWorkOSWidgetsLocale } from "./workos-widgets-locale"
import {
  getWorkOSWidgetMessagesSync,
  loadWorkOSWidgetMessages,
} from "./workos-widgets-messages"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { switchOrganization } from "./switch-org-action"
import {
  elevaWorkOsElements,
  getElevaWorkOsTheme,
} from "./workos-widgets-config"
import { useResolvedAppearance } from "./use-resolved-appearance"

interface OrgSwitcherWidgetProps {
  authToken: string
  onSwitch?: (params: { organizationId: string }) => Promise<void>
}

export function OrgSwitcherWidget({
  authToken,
  onSwitch,
}: OrgSwitcherWidgetProps) {
  const t = useTranslations("shell")
  const locale = useLocale()
  const resolvedLocale = resolveWorkOSWidgetsLocale(locale)
  const pathname = usePathname()
  const appearance = useResolvedAppearance()
  const [messages, setMessages] = React.useState(() =>
    getWorkOSWidgetMessagesSync(resolvedLocale)
  )

  React.useEffect(() => {
    let active = true
    void loadWorkOSWidgetMessages(resolvedLocale).then((loaded) => {
      if (active) setMessages(loaded)
    })
    return () => {
      active = false
    }
  }, [resolvedLocale])

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
      console.error(t("orgSwitchError"), err)
    }
  }

  return (
    <div
      className="eleva-org-switcher w-full"
      role="region"
      aria-label={t("orgSwitcher")}
    >
      <WorkOsLocaleProvider
        locale={resolvedLocale}
        initialMessages={messages ?? undefined}
      >
        <WorkOsWidgets
          theme={getElevaWorkOsTheme({ appearance })}
          elements={elevaWorkOsElements}
        >
          <OrganizationSwitcher
            authToken={authToken}
            switchToOrganization={handleSwitch}
            variant="outline"
          />
        </WorkOsWidgets>
      </WorkOsLocaleProvider>
    </div>
  )
}
