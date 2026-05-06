import { and, eq } from "drizzle-orm"
import { main } from "@eleva/db"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { captureException } from "@eleva/observability"
import {
  getCalendarToken,
  getAdapter,
  type CalendarProvider,
  type CalendarEventInput,
} from "@eleva/calendar"
import {
  sendBookingIcsEmail,
  sendRescheduleIcsEmail,
  sendCancellationIcsEmail,
  type IcsEmailPayload,
} from "./ics-email"

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

function resolveProvider(slug: string): CalendarProvider {
  const provider = SLUG_TO_PROVIDER[slug]
  if (!provider) throw new Error(`Unknown calendar slug: ${slug}`)
  return provider
}

async function loadBookingContext(
  orgId: string,
  sessionId: string,
  bookingId: string
): Promise<IcsEmailPayload | null> {
  const data = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        expertEmail: main.users.email,
        expertName: main.expertProfiles.displayName,
        eventTypeTitle: main.eventTypes.title,
        startsAt: main.sessions.startsAt,
        endsAt: main.sessions.endsAt,
        sessionMode: main.sessions.sessionMode,
        timezone: main.bookings.timezone,
        bookedLocale: main.bookings.bookedLocale,
      })
      .from(main.sessions)
      .innerJoin(main.bookings, eq(main.sessions.bookingId, main.bookings.id))
      .innerJoin(
        main.expertProfiles,
        eq(main.sessions.expertProfileId, main.expertProfiles.id)
      )
      .innerJoin(main.users, eq(main.expertProfiles.userId, main.users.id))
      .innerJoin(
        main.eventTypes,
        eq(main.sessions.eventTypeId, main.eventTypes.id)
      )
      .where(eq(main.sessions.id, sessionId))
      .limit(1)
    return row
  })

  if (!data) return null

  const patientData = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({ displayName: main.users.displayName })
      .from(main.bookings)
      .innerJoin(main.users, eq(main.bookings.patientUserId, main.users.id))
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    return row
  })

  const locale = (data.bookedLocale as "en" | "pt" | "es") ?? "en"
  const eventTypeName =
    data.eventTypeTitle?.[locale] ?? data.eventTypeTitle?.en ?? "Session"

  return {
    expertEmail: data.expertEmail,
    expertName: data.expertName,
    patientName: patientData?.displayName ?? "Patient",
    eventTypeName,
    bookingId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    timezone: data.timezone,
    sessionMode: data.sessionMode,
    locale,
  }
}

/**
 * Create a calendar event in the expert's destination calendar when a
 * booking is confirmed.
 *
 * If no destination calendar is configured, sends an .ics email to
 * the expert instead (calendar-optional mode).
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

    if (!destination) {
      const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
      if (emailPayload) {
        await sendBookingIcsEmail(emailPayload)
      }
      return { calendarEventId: null }
    }

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
    throw err
  }
}

/**
 * Update an existing calendar event (e.g., on reschedule).
 *
 * If no destination calendar is configured (calendar-optional mode),
 * sends an updated .ics email to the expert.
 */
export async function calendarEventUpdate(params: {
  sessionId: string
  bookingId: string
  orgId: string
  newStartTime: Date
  newEndTime: Date
  previousStartTime: Date
}): Promise<void> {
  const {
    sessionId,
    bookingId,
    orgId,
    newStartTime,
    newEndTime,
    previousStartTime,
  } = params

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

    if (!session) return

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

    if (!destination) {
      const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
      if (emailPayload) {
        const updated: IcsEmailPayload = {
          ...emailPayload,
          startsAt: newStartTime,
          endsAt: newEndTime,
          sequence: 1,
        }
        await sendRescheduleIcsEmail(updated, previousStartTime)
      }
      return
    }

    if (!session.calendarEventId) return

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
    throw err
  }
}

/**
 * Delete a calendar event (e.g., on cancellation).
 *
 * If no destination calendar is configured (calendar-optional mode),
 * sends a cancellation .ics email to the expert.
 */
export async function calendarEventDelete(params: {
  sessionId: string
  bookingId: string
  orgId: string
}): Promise<void> {
  const { sessionId, bookingId, orgId } = params

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

    if (!session) return

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

    if (!destination) {
      const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
      if (emailPayload) {
        await sendCancellationIcsEmail(emailPayload)
      }
      return
    }

    if (!session.calendarEventId) return

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

    try {
      await adapter.deleteEvent(
        accessToken,
        destination.externalCalendarId,
        session.calendarEventId
      )
    } catch (deleteErr) {
      const msg =
        deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
      const statusMatch = /:\s*(\d{3})/.exec(msg)
      const status = statusMatch ? Number(statusMatch[1]) : 0
      if (status !== 404 && status !== 410) {
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
