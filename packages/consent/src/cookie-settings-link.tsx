"use client"

import { ConsentDialogLink } from "c15t/next"
import type { ReactNode } from "react"

export function CookieSettingsLink({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <ConsentDialogLink className={className}>{children}</ConsentDialogLink>
}
