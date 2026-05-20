"use client"

import { Toaster } from "@eleva/ui/components/sonner"
import type { ThemePreference } from "@eleva/config/theme"
import { ElevaThemeProvider } from "./eleva-theme-provider"
import { useResolvedAppearance } from "./use-resolved-appearance"

function DashboardToaster() {
  const appearance = useResolvedAppearance()

  return (
    <Toaster
      theme={appearance}
      position="bottom-right"
      richColors
      closeButton
    />
  )
}

export function DashboardProviders({
  children,
  initialTheme = "system",
}: {
  children: React.ReactNode
  initialTheme?: ThemePreference
}) {
  return (
    <ElevaThemeProvider initialTheme={initialTheme}>
      {children}
      <DashboardToaster />
    </ElevaThemeProvider>
  )
}
