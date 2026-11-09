"use client"

import { useState } from "react"
import {
  createApiClient,
  SetActiveOrganizationRequestSchema,
} from "@eleva/api-client"
import { Button } from "@eleva/ui/components/button"

/**
 * Switches the person's active workspace to their staff membership from the
 * browser, so the API's updated session cookie reaches it, then reloads the
 * console. A server action would leave the browser on the old workspace.
 */
export function EnterStaffButton({
  staffOrgId,
  apiBaseUrl,
  label,
  errorLabel,
}: {
  staffOrgId: string
  apiBaseUrl: string
  label: string
  errorLabel: string
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function enter() {
    setPending(true)
    setFailed(false)
    try {
      const body = SetActiveOrganizationRequestSchema.parse({
        organizationId: staffOrgId,
      })
      await createApiClient({ baseUrl: apiBaseUrl }).organizations.setActive(
        body
      )
      window.location.assign("/")
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onPress={enter}
        isDisabled={pending}
        data-testid="staff-entry-submit"
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
