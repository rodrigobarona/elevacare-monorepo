"use client"

import { PublicNavigationProvider } from "@eleva/site-chrome/navigation"
import type { ReactNode } from "react"
import { Link, usePathname } from "@/i18n/navigation"

export function WebPublicNavigationProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <PublicNavigationProvider Link={Link} usePathname={usePathname}>
      {children}
    </PublicNavigationProvider>
  )
}
