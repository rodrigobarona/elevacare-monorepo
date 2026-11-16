import { logError } from "@eleva/observability"
import { getProviderAccessToken } from "@eleva/auth"
import {
  calendarProviderForSlug,
  createCredentialManager,
  getAdapter,
  requireAuthAccountId,
} from "@eleva/calendar"
import { listCalendarIntegrations } from "@eleva/db"

const credentials = createCredentialManager({ getProviderAccessToken })

/**
 * Confirm the external calendar ID belongs to the expert's connected
 * integration account (same rule as PUT /expert/integrations/{id}/destination).
 */
export async function assertExternalCalendarOwned(input: {
  userId: string
  orgId: string
  expertProfileId: string
  integrationId: string
  externalCalendarId: string
}): Promise<"ok" | "not_found" | "forbidden" | "provider_error"> {
  const integrations = await listCalendarIntegrations(
    input.orgId,
    input.expertProfileId
  )
  const integration = integrations.find((i) => i.id === input.integrationId)
  if (!integration) return "not_found"

  const provider = calendarProviderForSlug(integration.slug)
  if (!provider) return "not_found"

  try {
    const accessToken = await credentials.getCalendarToken(
      input.userId,
      provider,
      requireAuthAccountId(integration.authAccountId)
    )
    const adapter = getAdapter(provider)
    const calendars = await adapter.listCalendars(accessToken)
    const matched = calendars.find((c) => c.id === input.externalCalendarId)
    // Sessions are written here, so a read-only calendar does not qualify.
    return matched?.writable ? "ok" : "forbidden"
  } catch (err) {
    logError("calendar.assert_owned_list_failed", err)
    return "provider_error"
  }
}
