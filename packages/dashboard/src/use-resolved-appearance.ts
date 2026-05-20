"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import type { ResolvedAppearance } from "@eleva/config/theme"

/**
 * Hydration-safe light/dark for WorkOS widgets and Sonner.
 * Returns "light" until mounted, then follows next-themes resolvedTheme.
 */
export function useResolvedAppearance(): ResolvedAppearance {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return "light"
  return resolvedTheme === "dark" ? "dark" : "light"
}
