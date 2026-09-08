import { and, eq } from "drizzle-orm"
import { getProviderAccessToken } from "@eleva/auth"
import { auth, db, main } from "@eleva/db"
import { withOrgContext, type Tx } from "@eleva/db/context"
import { captureException } from "@eleva/observability"
import {
  createCredentialManager,
  requireAuthAccountId,
  getAdapter,
  CalendarNotFoundError,
  CalendarAdapterError,
  type CalendarProvider,
  type CalendarEventInput,
} from "@eleva/calendar"

import {
  sendBookingIcsEmail,
  sendRescheduleIcsEmail,
  sendCancellationIcsEmail,
  type IcsEmailPayload,
} from "./ics-email"

const credentials = createCredentialManager({ getProviderAccessToken })

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

function resolveProvider(slug: string): CalendarProvider {
  const provider = SLUG_TO_PROVIDER[slug]
  if (!provider) throw new Error(`Unknown calendar slug: ${slug}`)
  return provider
}

async function loadAuthUser(userId: string) {
  const [row] = await db()
    .select({ email: auth.user.email, name: auth.user.name })
    .from(auth.user)
    .where(eq(auth.user.id, userId))
    .limit(1)
  return row
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

async function loadBookingContext(
  orgId: string,
  sessionId: string,
  bookingId: string
): Promise<IcsEmailPayload | null> {
  const data = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        expertUserId: main.expertProfiles.userId,
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
      .innerJoin(
        main.eventTypes,
        eq(main.sessions.eventTypeId, main.eventTypes.id)
      )
      .where(eq(main.sessions.id, sessionId))
      .limit(1)
    return row
  })

  if (!data) return null

  const memberData = await withOrgContext(orgId, async (tx: Tx) => {
    const [row] = await tx
      .select({
        memberUserId: main.bookings.memberUserId,
      })
      .from(main.bookings)
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    return row
  })

  if (!memberData?.memberUserId) return null

  const [expertUser, memberUser] = await Promise.all([
    loadAuthUser(data.expertUserId),
    loadAuthUser(memberData.memberUserId),
  ])
  if (!expertUser || !memberUser) return null

  const locale = (data.bookedLocale as "en" | "pt" | "es") ?? "en"
  const eventTypeName =
    data.eventTypeTitle?.[locale] ?? data.eventTypeTitle?.en ?? "Session"

  const memberName = memberUser.name || "Member"

  return {
    expertEmail: expertUser.email,
    expertName: data.expertName,
    memberName,
    memberEmail: memberUser.email,
    eventTypeName,
    bookingId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    timezone: data.timezone,
    sessionMode: data.sessionMode,
    locale,
  }
}

async function sendCreateIcsFallback(
  orgId: string,
  sessionId: string,
  bookingId: string
): Promise<{ calendarEventId: null }> {
  const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
  if (emailPayload) await sendBookingIcsEmail(emailPayload)
  return { calendarEventId: null }
}

async function sendRescheduleIcsFallback(
  orgId: string,
  sessionId: string,
  bookingId: string,
  newStartTime: Date,
  newEndTime: Date,
  previousStartTime: Date
): Promise<void> {
  const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
  if (emailPayload) {
    await sendRescheduleIcsEmail(
      {
        ...emailPayload,
        startsAt: newStartTime,
        endsAt: newEndTime,
        sequence: Math.floor(Date.now() / 1000),
      },
      previousStartTime
    )
  }
}

async function sendCancellationIcsFallback(
  orgId: string,
  sessionId: string,
  bookingId: string
): Promise<void> {
  const emailPayload = await loadBookingContext(orgId, sessionId, bookingId)
  if (emailPayload) await sendCancellationIcsEmail(emailPayload)
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
      return sendCreateIcsFallback(orgId, sessionId, bookingId)
    }

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) {
      return sendCreateIcsFallback(orgId, sessionId, bookingId)
    }

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
          bookingTimezone: main.bookings.timezone,
        })
        .from(main.sessions)
        .innerJoin(main.bookings, eq(main.sessions.bookingId, main.bookings.id))
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
      await sendRescheduleIcsFallback(
        orgId,
        sessionId,
        bookingId,
        newStartTime,
        newEndTime,
        previousStartTime
      )
      return
    }

    if (!session.calendarEventId) return

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) {
      await sendRescheduleIcsFallback(
        orgId,
        sessionId,
        bookingId,
        newStartTime,
        newEndTime,
        previousStartTime
      )
      return
    }

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
      await sendCancellationIcsFallback(orgId, sessionId, bookingId)
      return
    }

    if (!session.calendarEventId) return

    const integration = await loadConnectedCalendar(
      orgId,
      destination.expertIntegrationId
    )
    if (!integration?.authAccountId) {
      await sendCancellationIcsFallback(orgId, sessionId, bookingId)
      return
    }

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
