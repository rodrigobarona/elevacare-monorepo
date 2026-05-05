import { and, eq } from "drizzle-orm"
import { db, main } from "@eleva/db"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { captureException } from "@eleva/observability"
import {
  getCalendarToken,
  getAdapter,
  type CalendarProvider,
  type CalendarEventInput,
} from "@eleva/calendar"

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

function resolveProvider(slug: string): CalendarProvider {
  const provider = SLUG_TO_PROVIDER[slug]
  if (!provider) throw new Error(`Unknown calendar slug: ${slug}`)
  return provider
}

/**
 * Create a calendar event in the expert's destination calendar when a
 * booking is confirmed.
 *
 * Uses the idempotencyId (booking ID) to prevent duplicate events on
 * retry. Google returns 409 on duplicate client-supplied event IDs;
 * the adapter returns the existing event in that case.
 */
export async function calendarEventCreate(params: {
  bookingId: string
  sessionId: string
  orgId: string
}): Promise<{ calendarEventId: string | null }> {
  const { bookingId, sessionId, orgId } = params

  try {
    const session = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertProfileId: main.sessions.expertProfileId,
          startsAt: main.sessions.startsAt,
          endsAt: main.sessions.endsAt,
          sessionMode: main.sessions.sessionMode,
        })
        .from(main.sessions)
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session) return { calendarEventId: null }

    const destination = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertIntegrationId: main.calendarDestinations.expertIntegrationId,
          externalCalendarId: main.calendarDestinations.externalCalendarId,
        })
        .from(main.calendarDestinations)
        .where(
          eq(main.calendarDestinations.expertProfileId, session.expertProfileId)
        )
        .limit(1)
      return row
    })

    if (!destination) return { calendarEventId: null }

    const integration = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          workosUserId: main.expertIntegrations.workosUserId,
          slug: main.expertIntegrations.slug,
        })
        .from(main.expertIntegrations)
        .where(
          and(
            eq(main.expertIntegrations.id, destination.expertIntegrationId),
            eq(main.expertIntegrations.status, "connected")
          )
        )
        .limit(1)
      return row
    })

    if (!integration?.workosUserId) return { calendarEventId: null }

    const provider = resolveProvider(integration.slug)
    const accessToken = await getCalendarToken(
      integration.workosUserId,
      provider
    )
    const adapter = getAdapter(provider)

    const eventInput: CalendarEventInput = {
      calendarId: destination.externalCalendarId,
      summary: `Eleva Session`,
      startTime: session.startsAt,
      endTime: session.endsAt,
      timezone: "UTC",
      idempotencyId: bookingId,
    }

    const calEvent = await adapter.createEvent(accessToken, eventInput)

    await withOrgContext(orgId, async (tx: Tx) => {
      await tx
        .update(main.sessions)
        .set({ calendarEventId: calEvent.id, updatedAt: new Date() })
        .where(eq(main.sessions.id, sessionId))
    })

    return { calendarEventId: calEvent.id }
  } catch (err) {
    await captureException(err, {
      workflow: "calendarEventCreate",
      bookingId,
      sessionId,
    })
    return { calendarEventId: null }
  }
}

/**
 * Update an existing calendar event (e.g., on reschedule).
 */
export async function calendarEventUpdate(params: {
  sessionId: string
  orgId: string
  newStartTime: Date
  newEndTime: Date
}): Promise<void> {
  const { sessionId, orgId, newStartTime, newEndTime } = params

  try {
    const session = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertProfileId: main.sessions.expertProfileId,
          calendarEventId: main.sessions.calendarEventId,
        })
        .from(main.sessions)
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session?.calendarEventId) return

    const destination = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertIntegrationId: main.calendarDestinations.expertIntegrationId,
          externalCalendarId: main.calendarDestinations.externalCalendarId,
        })
        .from(main.calendarDestinations)
        .where(
          eq(main.calendarDestinations.expertProfileId, session.expertProfileId)
        )
        .limit(1)
      return row
    })

    if (!destination) return

    const integration = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          workosUserId: main.expertIntegrations.workosUserId,
          slug: main.expertIntegrations.slug,
        })
        .from(main.expertIntegrations)
        .where(
          and(
            eq(main.expertIntegrations.id, destination.expertIntegrationId),
            eq(main.expertIntegrations.status, "connected")
          )
        )
        .limit(1)
      return row
    })

    if (!integration?.workosUserId) return

    const provider = resolveProvider(integration.slug)
    const accessToken = await getCalendarToken(
      integration.workosUserId,
      provider
    )
    const adapter = getAdapter(provider)

    await adapter.updateEvent(
      accessToken,
      destination.externalCalendarId,
      session.calendarEventId,
      { startTime: newStartTime, endTime: newEndTime, timezone: "UTC" }
    )
  } catch (err) {
    await captureException(err, {
      workflow: "calendarEventUpdate",
      sessionId,
    })
  }
}

/**
 * Delete a calendar event (e.g., on cancellation).
 */
export async function calendarEventDelete(params: {
  sessionId: string
  orgId: string
}): Promise<void> {
  const { sessionId, orgId } = params

  try {
    const session = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertProfileId: main.sessions.expertProfileId,
          calendarEventId: main.sessions.calendarEventId,
        })
        .from(main.sessions)
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session?.calendarEventId) return

    const destination = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          expertIntegrationId: main.calendarDestinations.expertIntegrationId,
          externalCalendarId: main.calendarDestinations.externalCalendarId,
        })
        .from(main.calendarDestinations)
        .where(
          eq(main.calendarDestinations.expertProfileId, session.expertProfileId)
        )
        .limit(1)
      return row
    })

    if (!destination) return

    const integration = await withOrgContext(orgId, async (tx: Tx) => {
      const [row] = await tx
        .select({
          workosUserId: main.expertIntegrations.workosUserId,
          slug: main.expertIntegrations.slug,
        })
        .from(main.expertIntegrations)
        .where(
          and(
            eq(main.expertIntegrations.id, destination.expertIntegrationId),
            eq(main.expertIntegrations.status, "connected")
          )
        )
        .limit(1)
      return row
    })

    if (!integration?.workosUserId) return

    const provider = resolveProvider(integration.slug)
    const accessToken = await getCalendarToken(
      integration.workosUserId,
      provider
    )
    const adapter = getAdapter(provider)

    await adapter.deleteEvent(
      accessToken,
      destination.externalCalendarId,
      session.calendarEventId
    )

    await withOrgContext(orgId, async (tx: Tx) => {
      await tx
        .update(main.sessions)
        .set({ calendarEventId: null, updatedAt: new Date() })
        .where(eq(main.sessions.id, sessionId))
    })
  } catch (err) {
    await captureException(err, {
      workflow: "calendarEventDelete",
      sessionId,
    })
  }
}
