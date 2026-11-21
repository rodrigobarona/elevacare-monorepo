"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"

/** Set by the decision form just before the page reloads with the result. */
export const DECIDED_KEY = "eleva.clinic-decided"

/**
 * What happened to a decided filing. After a decision the form is gone, so
 * the keyboard's place moves here instead of being lost.
 */
export function FilingNote({
  verificationId,
  children,
}: {
  verificationId: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    try {
      if (sessionStorage.getItem(DECIDED_KEY) !== verificationId) return
      sessionStorage.removeItem(DECIDED_KEY)
    } catch {
      return
    }
    ref.current?.focus()
  }, [verificationId])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Alert>
        <AlertDescription data-testid="clinic-filing-note">
          {children}
        </AlertDescription>
      </Alert>
    </div>
  )
}
