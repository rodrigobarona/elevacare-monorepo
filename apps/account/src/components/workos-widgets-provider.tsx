"use client"

import { WorkOsWidgets } from "@workos-inc/widgets"
import {
  type LocaleCode,
  isValidLocale,
  WorkOsLocaleProvider,
} from "@workos-inc/widgets-i18n"
import {
  ELEVA_WORKOS_WRAPPER_CLASS,
  elevaWorkOsElements,
  getElevaWorkOsTheme,
} from "@eleva/dashboard/workos-widgets-config"
import { useResolvedAppearance } from "@eleva/dashboard/use-resolved-appearance"

export function ElevaWidgetsProvider({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}) {
  const resolvedLocale: LocaleCode = isValidLocale(locale) ? locale : "en"
  const appearance = useResolvedAppearance()

  return (
    <WorkOsLocaleProvider locale={resolvedLocale}>
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
