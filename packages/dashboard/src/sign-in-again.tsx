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
 * The notice itself is ordinary content (a note). With `answersAPress` its
 * words are an alert: it appeared because a press did not go through, so a
 * screen reader says it at once. Only the words are the alert: the button
 * changing its label must not make the whole message be read again.
 */
export function SignInAgainNotice({
  title,
  children,
  action,
  failure,
  answersAPress = false,
  size = "compact",
  className,
  "data-testid": testId,
}: {
  title?: string
  children: React.ReactNode
  action: SignInAgainAction
  /** Shown under the button when the sign-in page could not be opened. */
  failure?: string | null
  answersAPress?: boolean
  /** `roomy` at the top of a page, beside cards; `compact` inside one. */
  size?: "compact" | "roomy"
  className?: string
  "data-testid"?: string
}) {
  return (
    <Alert
      variant="notice"
      role="note"
      // The page's own hairline, so the notice has an edge on a pale ground.
      className={cn(
        "rounded-xl border-border max-sm:px-3",
        size === "roomy" && "sm:px-6 sm:py-4",
        className
      )}
      data-testid={testId}
    >
      <InfoIcon aria-hidden />
      <div className="col-start-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div
          className="space-y-0.5"
          role={answersAPress ? "alert" : undefined}
          data-testid="sign-in-again-words"
        >
          {title ? <AlertTitle>{title}</AlertTitle> : null}
          <AlertDescription className="text-pretty">
            {children}
          </AlertDescription>
        </div>
        {/* On a phone the button lines up with the notice, not the text
            column: back under the icon, the full width. */}
        <div className="flex shrink-0 flex-col gap-2 max-sm:-ml-6.5 sm:items-end">
          <Button
            variant="outline"
            // On the notice's tinted ground the kit's hairline is lost: the
            // one way forward gets an edge that can be seen. Wide enough
            // for its longer label, so the words beside it do not move.
            className="min-w-36 border-input-border bg-background max-sm:h-10 max-sm:w-full"
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
 * appears, so they continue from the form and not from the top of the
 * page; being focused is how a screen reader comes to say it.
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
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="notice"
      role="note"
      // A different ground from the warning, and an edge that stays after
      // the keyboard has moved on. Focus is only ever put here by the page.
      className={cn(
        "rounded-xl border-primary/30 bg-primary/5 outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      data-testid={testId}
    >
      <CheckCircleIcon aria-hidden />
      <AlertDescription className="text-pretty text-foreground">
        {children}
      </AlertDescription>
    </Alert>
  )
}
