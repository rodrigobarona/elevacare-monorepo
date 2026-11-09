"use client"

import { useState } from "react"
import { authClient } from "@eleva/auth/client"
import { signOutAndLeave } from "@eleva/auth/sign-out"
import { Button } from "@eleva/ui/components/button"

/**
 * Signs out on the one auth server (`apps/api`), which deletes the session
 * and clears the shared cookie, then returns to the site. No session (401)
 * counts as signed out.
 */
export function SignOutButton({
  gatewayUrl,
  label,
  errorLabel,
}: {
  gatewayUrl: string
  label: string
  errorLabel: string
}) {
  const [isPending, setIsPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signOut() {
    setIsPending(true)
    setFailed(false)
    const outcome = await signOutAndLeave({
      signOut: () => authClient.signOut(),
      leave: () => window.location.assign(gatewayUrl),
    })
    if (outcome === "failed") {
      setFailed(true)
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        className="w-full"
        data-testid="logout-submit"
        isPending={isPending}
        onPress={() => void signOut()}
      >
        {label}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {errorLabel}
        </p>
      ) : null}
    </div>
  )
}
