import { db } from '@/drizzle/db';
import { MeetingsTable, SlotReservationsTable } from '@/drizzle/schema';
import { withAuth } from '@workos-inc/authkit-nextjs';
import * as Sentry from '@sentry/nextjs';
import { and, eq, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

// Add route segment config

export async function GET() {
  try {
    const { user } = await withAuth();
  const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the expert's timezone from their schedule
    const schedule = await db.query.SchedulesTable.findFirst({
      where: (fields, { eq: eqOp }) => eqOp(fields.workosUserId, userId),
    });

    // Default to UTC if no schedule is found (fallback)
    const expertTimezone = schedule?.timezone || 'UTC';

    // Fetch all confirmed meetings for the expert
    const appointments = await db.query.MeetingsTable.findMany({
      where: eq(MeetingsTable.workosUserId, userId),
      orderBy: (meetings, { desc }) => [desc(meetings.startTime)],
    });

    // Fetch active slot reservations for the expert
    const currentTime = new Date();
    const reservations = await db.query.SlotReservationsTable.findMany({
      where: and(
        eq(SlotReservationsTable.workosUserId, userId),
        gt(SlotReservationsTable.expiresAt, currentTime),
      ),
      orderBy: (reservations, { desc }) => [desc(reservations.startTime)],
    });

    logger.info(logger.fmt`Found ${appointments.length} appointments and ${reservations.length} active reservations for expert ${userId}`, {
      timezone: expertTimezone,
    });

    return NextResponse.json({
      expertTimezone, // Include expert's timezone in response
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        type: 'appointment' as const,
        guestName: appointment.guestName,
        guestEmail: appointment.guestEmail,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        timezone: appointment.timezone, // This is the guest's timezone (kept for reference)
        meetingUrl: appointment.meetingUrl,
        guestNotes: appointment.guestNotes,
        stripePaymentStatus: appointment.stripePaymentStatus,
        stripeTransferStatus: appointment.stripeTransferStatus,
      })),
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        type: 'reservation' as const,
        guestName: reservation.guestEmail,
        guestEmail: reservation.guestEmail,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        timezone: 'UTC', // Reservations don't have a timezone yet
        expiresAt: reservation.expiresAt,
        stripeSessionId: reservation.stripeSessionId,
        stripePaymentIntentId: reservation.stripePaymentIntentId,
        eventId: reservation.eventId,
      })),
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching appointments and reservations', { error });
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
  }
}
