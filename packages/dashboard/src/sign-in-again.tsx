"use client"

import * as React from "react"
import { CheckCircleIcon, InfoIcon } from "@eleva/icons"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

export interface SignInAgainAction {
  label: string
  pendingLabel: string
  isPending: boolean
  onPress: () => void
}

/**
 * A calm notice that a task needs a newer sign-in, with the one button that
 * gets it. Not an error style: nothing is wrong with what the person did.
 *
 * `announce` says how a screen reader hears it. A notice that is on the
 * page when it opens is ordinary content (`off`); one that appears later
 * is said when the reader pauses (`polite`); one that answers a press that
 * did not go through is said at once (`now`).
 */
export function SignInAgainNotice({
  title,
  children,
  action,
  failure,
  announce = "off",
  className,
  "data-testid": testId,
}: {
  title?: string
  children: React.ReactNode
  action: SignInAgainAction
  /** Shown under the button when the sign-in page could not be opened. */
  failure?: string | null
  announce?: "off" | "polite" | "now"
  className?: string
  "data-testid"?: string
}) {
  return (
    <Alert
      variant="notice"
      role={
        announce === "now" ? "alert" : announce === "polite" ? "status" : "note"
      }
      aria-live={
        announce === "now"
          ? "assertive"
          : announce === "polite"
            ? "polite"
            : "off"
      }
      className={className}
      data-testid={testId}
    >
      <InfoIcon aria-hidden />
      <div className="col-start-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="space-y-0.5">
          {title ? <AlertTitle>{title}</AlertTitle> : null}
          <AlertDescription className="text-pretty">
            {children}
          </AlertDescription>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            variant="outline"
            size="sm"
            // On the notice's tinted ground the kit's hairline is lost: the
            // one way forward gets an edge that can be seen.
            className="border-input-border bg-background max-sm:h-10 max-sm:w-full"
            // Stays in the tab order while it works, so a second press
            // does nothing and the keyboard's place is not lost.
            isPending={action.isPending}
            onPress={action.onPress}
            data-testid="sign-in-again"
          >
            {action.isPending ? action.pendingLabel : action.label}
          </Button>
          {failure ? (
            <p
              role="alert"
              className="text-sm text-destructive sm:max-w-56 sm:text-right"
              data-testid="sign-in-again-failure"
            >
              {failure}
            </p>
          ) : null}
        </div>
      </div>
    </Alert>
  )
}

/**
 * What a person reads when they are back from signing in and what they
 * had entered is on the page again. It takes the keyboard's place when it
 * appears, so they continue from the form and not from the top of the page.
 */
export function SignedInAgainNotice({
  children,
  className,
  "data-testid": testId,
}: {
  children: React.ReactNode
  className?: string
  "data-testid"?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn(
        "rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      data-testid={testId}
    >
      <Alert variant="notice">
        <CheckCircleIcon aria-hidden />
        <AlertDescription className="text-pretty text-foreground">
          {children}
        </AlertDescription>
      </Alert>
    </div>
  )
}
