"use client"

import * as React from "react"

import { THEME_STORAGE_KEY } from "@/components/theme-script"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
)

function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme
}

function applyTheme(resolved: "light" | "dark") {
  const d = document.documentElement
  d.classList.remove("light", "dark")
  d.classList.add(resolved)
  d.style.colorScheme = resolved
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system")
  const [resolvedTheme, setResolved] = React.useState<"light" | "dark">("light")

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(THEME_STORAGE_KEY, next)
    const resolved = resolveTheme(next)
    setResolved(resolved)
    applyTheme(resolved)
  }, [])

  React.useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    const current = stored || "system"
    setThemeState(current)
    const resolved = resolveTheme(current)
    setResolved(resolved)
    applyTheme(resolved)
  }, [])

  React.useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    function onChange() {
      const resolved = getSystemTheme()
      setResolved(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <ThemeHotkey />
    </ThemeContext.Provider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export { ThemeProvider, useTheme }
