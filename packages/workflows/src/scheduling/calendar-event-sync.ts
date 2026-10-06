import { and, eq } from "drizzle-orm"
import { getProviderAccessToken } from "@eleva/auth"
import {
  main,
  getDestinationCalendar,
  resolveBookingDestination,
} from "@eleva/db"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { captureException } from "@eleva/observability"
import {
  calendarProviderForSlug,
  createCredentialManager,
  requireAuthAccountId,
  getAdapter,
  CalendarNotFoundError,
  CalendarAdapterError,
  type CalendarProvider,
  type CalendarEventInput,
} from "@eleva/calendar"

const credentials = createCredentialManager({ getProviderAccessToken })

function resolveProvider(slug: string): CalendarProvider {
  const provider = calendarProviderForSlug(slug)
  if (!provider) throw new Error(`Unknown calendar slug: ${slug}`)
  return provider
}

async function loadConnectedCalendar(orgId: string, integrationId: string) {
  return withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        authAccountId: main.expertIntegrations.authAccountId,
        slug: main.expertIntegrations.slug,
        userId: main.expertProfiles.userId,
      })
      .from(main.expertIntegrations)
      .innerJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.expertIntegrations.expertProfileId)
      )
      .where(
        and(
          eq(main.expertIntegrations.id, integrationId),
          eq(main.expertIntegrations.status, "connected")
        )
      )
      .limit(1)
    return row
  })
}

async function calendarAccessToken(
  userId: string,
  slug: string,
  authAccountId: string | null
) {
  const provider = resolveProvider(slug)
  const accessToken = await credentials.getCalendarToken(
    userId,
    provider,
    requireAuthAccountId(authAccountId)
  )
  return { provider, accessToken }
}

/**
 * Create a calendar event in the expert's destination calendar when a
 * booking is confirmed.
 *
 * Without a connected destination calendar this is a no-op: booking
 * notification emails already carry an .ics attachment for both parties.
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
          eventTypeId: main.sessions.eventTypeId,
          eventTypeModeId: main.bookings.eventTypeModeId,
          startsAt: main.sessions.startsAt,
          endsAt: main.sessions.endsAt,
          sessionMode: main.sessions.sessionMode,
          eventTypeTitle: main.eventTypes.title,
          bookingTimezone: main.bookings.timezone,
          bookedLocale: main.bookings.bookedLocale,
        })
        .from(main.sessions)
        .innerJoin(main.bookings, eq(main.sessions.bookingId, main.bookings.id))
        .innerJoin(
          main.eventTypes,
          eq(main.sessions.eventTypeId, main.eventTypes.id)
        )
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session) return { calendarEventId: null }

    const destination = await resolveBookingDestination(
      orgId,
      session.expertProfileId,
      session.eventTypeId,
      session.eventTypeModeId
    )
    if (!destination) return { calendarEventId: null }

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) return { calendarEventId: null }

    const { provider, accessToken } = await calendarAccessToken(
      integration.userId,
      integration.slug,
      integration.authAccountId
    )
    const adapter = getAdapter(provider)

    const locale = (session.bookedLocale as "en" | "pt" | "es") ?? "en"
    const eventTitle =
      session.eventTypeTitle?.[locale] ??
      session.eventTypeTitle?.en ??
      "Eleva Session"

    const eventInput: CalendarEventInput = {
      calendarId: destination.externalCalendarId,
      summary: eventTitle,
      startTime: session.startsAt,
      endTime: session.endsAt,
      timezone: session.bookingTimezone ?? "UTC",
      idempotencyId: bookingId,
    }

    const calEvent = await adapter.createEvent(accessToken, eventInput)

    await withOrgContext(orgId, async (tx: Tx) => {
      await tx
        .update(main.sessions)
        .set({
          calendarEventId: calEvent.id,
          calendarDestinationIntegrationId: destination.expertIntegrationId,
          calendarDestinationExternalId: destination.externalCalendarId,
          updatedAt: new Date(),
        })
        .where(eq(main.sessions.id, sessionId))
    })

    return { calendarEventId: calEvent.id }
  } catch (err) {
    await captureException(err, {
      workflow: "calendarEventCreate",
      bookingId,
      sessionId,
    })
    throw err
  }
}

/**
 * Update an existing calendar event (e.g., on reschedule). No-op when the
 * session has no external event; the reschedule email carries the .ics.
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
          calendarDestinationIntegrationId:
            main.sessions.calendarDestinationIntegrationId,
          calendarDestinationExternalId:
            main.sessions.calendarDestinationExternalId,
          bookingTimezone: main.bookings.timezone,
        })
        .from(main.sessions)
        .innerJoin(main.bookings, eq(main.sessions.bookingId, main.bookings.id))
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session?.calendarEventId) return

    const destination =
      session.calendarDestinationIntegrationId &&
      session.calendarDestinationExternalId
        ? {
            expertIntegrationId: session.calendarDestinationIntegrationId,
            externalCalendarId: session.calendarDestinationExternalId,
          }
        : // Pre-0046 sessions: keep the expert default used at create.
          await getDestinationCalendar(orgId, session.expertProfileId)
    if (!destination) return

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) return

    const { provider, accessToken } = await calendarAccessToken(
      integration.userId,
      integration.slug,
      integration.authAccountId
    )
    const adapter = getAdapter(provider)

    await adapter.updateEvent(
      accessToken,
      destination.externalCalendarId,
      session.calendarEventId,
      {
        startTime: newStartTime,
        endTime: newEndTime,
        timezone: session.bookingTimezone ?? "UTC",
      }
    )
  } catch (err) {
    await captureException(err, {
      workflow: "calendarEventUpdate",
      sessionId,
    })
    throw err
  }
}

/**
 * Delete a calendar event (e.g., on cancellation). No-op when the session
 * has no external event; the cancellation email carries the .ics.
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
          calendarDestinationIntegrationId:
            main.sessions.calendarDestinationIntegrationId,
          calendarDestinationExternalId:
            main.sessions.calendarDestinationExternalId,
        })
        .from(main.sessions)
        .where(eq(main.sessions.id, sessionId))
        .limit(1)
      return row
    })

    if (!session?.calendarEventId) return

    const destination =
      session.calendarDestinationIntegrationId &&
      session.calendarDestinationExternalId
        ? {
            expertIntegrationId: session.calendarDestinationIntegrationId,
            externalCalendarId: session.calendarDestinationExternalId,
          }
        : await getDestinationCalendar(orgId, session.expertProfileId)
    if (!destination) return

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) return

    const { provider, accessToken } = await calendarAccessToken(
      integration.userId,
      integration.slug,
      integration.authAccountId
    )
    const adapter = getAdapter(provider)

    try {
      await adapter.deleteEvent(
        accessToken,
        destination.externalCalendarId,
        session.calendarEventId
      )
    } catch (deleteErr) {
      if (deleteErr instanceof CalendarNotFoundError) {
        // Event already deleted externally -- safe to ignore.
      } else if (
        deleteErr instanceof CalendarAdapterError &&
        deleteErr.statusCode === 410
      ) {
        // Gone -- event was already removed.
      } else {
        throw deleteErr
      }
    }

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
    throw err
  }
}
