"use client"

import { useEffect, useRef } from "react"
import { ThemeProvider, useTheme } from "next-themes"
import { parseThemeFromCookie, type ThemePreference } from "@eleva/config/theme"

const STORAGE_KEY = "eleva-theme"

function ThemeCookieSync() {
  const { setTheme } = useTheme()
  const setThemeRef = useRef(setTheme)
  setThemeRef.current = setTheme

  // Align next-themes localStorage with ELEVA_THEME once on mount (cross-subdomain SSOT).
  useEffect(() => {
    const fromCookie = parseThemeFromCookie(document.cookie)
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      // ignore (e.g. private mode)
    }

    if (stored === fromCookie) return
    setThemeRef.current(fromCookie)
  }, [])

  return null
}

export function ElevaThemeProvider({
  children,
  initialTheme = "system",
}: {
  children: React.ReactNode
  initialTheme?: ThemePreference
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={initialTheme}
      enableSystem
      storageKey={STORAGE_KEY}
      disableTransitionOnChange
      themes={["light", "dark", "system"]}
    >
      <ThemeCookieSync />
      {children}
    </ThemeProvider>
  )
}
