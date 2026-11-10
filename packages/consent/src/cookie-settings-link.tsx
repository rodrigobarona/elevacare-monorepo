"use client"

import type { ReactNode } from "react"
import { useOpenCookieSettings } from "./open-cookie-settings"

/**
 * Footer control that reopens the cookie preferences dialog. A plain
 * button styled by the caller, so it lines up with the links around it
 * (c15t's own link component brings its own centred button styles).
 * Hidden when this visitor has no preferences to manage.
 */
export function CookieSettingsLink({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const open = useOpenCookieSettings()
  if (!open) return null
  return (
    <button
      type="button"
      onClick={open}
      className={["cursor-pointer text-left", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  )
}
