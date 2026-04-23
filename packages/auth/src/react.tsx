"use client"

import type { ReactNode } from "react"

export interface ClientSessionShape {
  user: { id: string; email: string; displayName?: string | null }
  orgId: string
  productLabel: "patient" | "expert" | "clinic_admin" | "eleva_operator"
  capabilities: readonly string[]
}

/**
 * Client-side permission gate. Use in Client Components where the
 * session has been serialised into a client prop. Server Components
 * should use `requireSession(capability)` instead.
 *
 * Intentionally does not render a fallback by default \u2014 UI should be
 * absent, not "access denied" (avoids information leakage about what
 * surfaces exist).
 */
export function PermissionGate({
  session,
  capability,
  fallback = null,
  children,
}: {
  session: ClientSessionShape | null
  capability: string
  fallback?: ReactNode
  children: ReactNode
}) {
  if (!session || !session.capabilities.includes(capability)) {
    return <>{fallback}</>
  }
  return <>{children}</>
}

export function usePermission(
  session: ClientSessionShape | null,
  capability: string
): boolean {
  if (!session) return false
  return session.capabilities.includes(capability)
}
