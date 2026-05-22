"use client"

import * as React from "react"
import { WorkOsWidgets } from "@workos-inc/widgets"
import { WorkOsLocaleProvider } from "@workos-inc/widgets-i18n"
import {
  ELEVA_WORKOS_WRAPPER_CLASS,
  elevaWorkOsElements,
  getElevaWorkOsTheme,
} from "@eleva/dashboard/workos-widgets-config"
import { resolveWorkOSWidgetsLocale } from "@eleva/dashboard/workos-widgets-locale"
import {
  getWorkOSWidgetMessagesSync,
  loadWorkOSWidgetMessages,
} from "@eleva/dashboard/workos-widgets-messages"
import { useResolvedAppearance } from "@eleva/dashboard/use-resolved-appearance"

export function ElevaWidgetsProvider({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  const resolvedLocale = resolveWorkOSWidgetsLocale(locale)
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

  return (
    <WorkOsLocaleProvider
      locale={resolvedLocale}
      initialMessages={messages ?? undefined}
    >
      <WorkOsWidgets
        className={ELEVA_WORKOS_WRAPPER_CLASS}
        theme={getElevaWorkOsTheme({ appearance })}
        elements={elevaWorkOsElements}
      >
        {children}
      </WorkOsWidgets>
    </WorkOsLocaleProvider>
  )
}
