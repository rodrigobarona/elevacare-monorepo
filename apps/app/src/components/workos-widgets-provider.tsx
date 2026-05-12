"use client"

import { WorkOsWidgets } from "@workos-inc/widgets"
import { WorkOsLocaleProvider } from "@workos-inc/widgets-i18n"

export function ElevaWidgetsProvider({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  return (
    <WorkOsLocaleProvider locale={locale}>
      <WorkOsWidgets
        theme={{
          accentColor: "teal",
          radius: "medium",
          fontFamily: "DM Sans",
        }}
      >
        {children}
      </WorkOsWidgets>
    </WorkOsLocaleProvider>
  )
}
