"use client"

import { WorkOsWidgets } from "@workos-inc/widgets"
import {
  type LocaleCode,
  isValidLocale,
  WorkOsLocaleProvider,
} from "@workos-inc/widgets-i18n"

export function ElevaWidgetsProvider({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  const resolvedLocale: LocaleCode = isValidLocale(locale) ? locale : "en"

  return (
    <WorkOsLocaleProvider locale={resolvedLocale}>
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
