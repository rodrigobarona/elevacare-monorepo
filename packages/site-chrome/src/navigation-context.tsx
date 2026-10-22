"use client"

import type { ComponentType, ReactNode } from "react"
import { createContext, useContext } from "react"

export type PublicNavLinkProps = {
  href: string
  className?: string
  children?: ReactNode
  "aria-label"?: string
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

type PublicNavigationContextValue = {
  Link: ComponentType<PublicNavLinkProps>
  usePathname: () => string
}

const PublicNavigationContext = createContext<
  PublicNavigationContextValue | undefined
>(undefined)

export function PublicNavigationProvider({
  Link,
  usePathname,
  children,
}: PublicNavigationContextValue & { children: ReactNode }) {
  return (
    <PublicNavigationContext.Provider value={{ Link, usePathname }}>
      {children}
    </PublicNavigationContext.Provider>
  )
}

export function usePublicNavigation() {
  const value = useContext(PublicNavigationContext)
  if (!value) {
    throw new Error(
      "usePublicNavigation requires PublicNavigationProvider (wrap the public site header in apps/web)."
    )
  }
  return value
}
