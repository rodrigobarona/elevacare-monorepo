"use client"

import { useHasConsentPreferences, useSetActiveUI } from "c15t/next"
import { createContext, useContext, type ReactNode } from "react"

const ConsentAvailableContext = createContext(false)

/** Mounted by `ConsentShell`, so controls know the c15t kernel is there. */
export function ConsentAvailableProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ConsentAvailableContext.Provider value>
      {children}
    </ConsentAvailableContext.Provider>
  )
}

/**
 * False in apps without `ConsentShell` (the staff console). Check it before
 * rendering anything that calls {@link useOpenCookieSettings}: c15t hooks
 * throw outside their provider.
 */
export function useConsentAvailable(): boolean {
  return useContext(ConsentAvailableContext)
}

/**
 * Opens the cookie preferences dialog from any control, such as a menu item
 * that cannot wrap a link. Returns null when this visitor has no preferences
 * to manage, so callers hide the control (same rule as `CookieSettingsLink`).
 * Call only under `ConsentShell` (see {@link useConsentAvailable}).
 */
export function useOpenCookieSettings(): (() => void) | null {
  const setActiveUI = useSetActiveUI()
  const hasPreferences = useHasConsentPreferences()
  if (!hasPreferences) return null
  return () => setActiveUI("dialog")
}
