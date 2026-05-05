import { and, eq, lte, ne } from "drizzle-orm"
import { db, main } from "@eleva/db"
import { captureException, heartbeat } from "@eleva/observability"
import { getAccessToken } from "@eleva/calendar"

/**
 * Proactive token refresh for connected calendars approaching expiry.
 * Runs on a periodic schedule (e.g., every 15 minutes). Refreshes
 * tokens that expire within the next 30 minutes.
 *
 * On refresh failure the calendar is marked 'error' and a
 * calendar_disconnected notification should fire (Sprint 4 Lane 1).
 */

export interface TokenRefreshResult {
  refreshed: number
  errors: number
}

const REFRESH_BUFFER_MS = 30 * 60 * 1000

export async function refreshExpiringTokens(): Promise<TokenRefreshResult> {
  const mainDb = db()
  const result: TokenRefreshResult = { refreshed: 0, errors: 0 }

  const expiring = await mainDb
    .select({
      id: main.connectedCalendars.id,
      orgId: main.connectedCalendars.orgId,
      expertProfileId: main.connectedCalendars.expertProfileId,
    })
    .from(main.connectedCalendars)
    .where(
      and(
        ne(main.connectedCalendars.status, "disconnected"),
        lte(
          main.connectedCalendars.tokenExpiresAt,
          new Date(Date.now() + REFRESH_BUFFER_MS)
        )
      )
    )
    .limit(50)

  for (const cal of expiring) {
    try {
      await getAccessToken(cal.orgId, cal.id)
      result.refreshed += 1
    } catch (err) {
      result.errors += 1

      await mainDb
        .update(main.connectedCalendars)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(main.connectedCalendars.id, cal.id))

      await captureException(err, {
        workflow: "calendarTokenRefresh",
        connectedCalendarId: cal.id,
        expertProfileId: cal.expertProfileId,
      })
    }
  }

  await heartbeat("calendar-token-refresh")
  return result
}
