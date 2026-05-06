import { WorkOS } from "@workos-inc/node"
import type { CalendarProvider } from "./types"

/**
 * WorkOS Pipes provider slugs. Configure these in the WorkOS Dashboard:
 *
 * google-calendar scopes:
 *   - calendar.calendarlist.readonly  (listCalendars)
 *   - calendar.events.freebusy        (getFreeBusy)
 *   - calendar.events.owned           (createEvent, updateEvent, deleteEvent)
 *
 * microsoft-outlook-calendar scopes:
 *   - Calendars.ReadWrite
 *   - offline_access
 */
const PIPES_SLUG: Record<CalendarProvider, string> = {
  google: "google-calendar",
  microsoft: "microsoft-outlook-calendar",
}

export class CalendarTokenError extends Error {
  readonly code: string
  constructor(code: string) {
    super(`Calendar token error: ${code}`)
    this.name = "CalendarTokenError"
    this.code = code
  }
}

let _workos: WorkOS | null = null

function workos(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required for calendar Pipes")
    _workos = new WorkOS(key)
  }
  return _workos
}

/**
 * Get a fresh access token for a calendar provider via WorkOS Pipes.
 * Pipes handles token storage, refresh, and expiry automatically.
 *
 * @param workosUserId - The WorkOS user ID (from session.user.workosUserId)
 * @param provider - Calendar provider ("google" or "microsoft")
 * @throws CalendarTokenError with code "needs_reauthorization" or "not_installed"
 */
export async function getCalendarToken(
  workosUserId: string,
  provider: CalendarProvider
): Promise<string> {
  const slug = PIPES_SLUG[provider]
  const result = await workos().pipes.getAccessToken({
    provider: slug,
    userId: workosUserId,
  })

  if (result.active) {
    return result.accessToken.accessToken
  }

  throw new CalendarTokenError(result.error ?? "not_installed")
}

/**
 * Check which calendar providers a user has connected via Pipes.
 */
export async function listConnectedProviders(
  workosUserId: string
): Promise<{ provider: CalendarProvider; connected: boolean }[]> {
  const providers: { provider: CalendarProvider; connected: boolean }[] = []

  for (const [provider, slug] of Object.entries(PIPES_SLUG)) {
    try {
      const result = await workos().pipes.getAccessToken({
        provider: slug,
        userId: workosUserId,
      })
      providers.push({
        provider: provider as CalendarProvider,
        connected: result.active,
      })
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("not_found") ||
          err.message.includes("not_installed"))
      ) {
        providers.push({
          provider: provider as CalendarProvider,
          connected: false,
        })
      } else {
        throw err
      }
    }
  }

  return providers
}
