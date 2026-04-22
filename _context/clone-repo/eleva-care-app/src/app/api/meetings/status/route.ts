import { db } from '@/drizzle/db';
import { checkRateLimit } from '@/lib/redis/rate-limiter';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function GET(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rl = await checkRateLimit(ip, 30, 60, 'meeting-status');
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime');
    const eventSlug = searchParams.get('eventSlug');

    if (!startTime || !eventSlug) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // First get the event by slug
    const event = await db.query.EventsTable.findFirst({
      where: (events, { eq }) => eq(events.slug, eventSlug),
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Then check for the meeting
    const meeting = await db.query.MeetingsTable.findFirst({
      where: ({ eventId, startTime: meetingStartTime }, { eq, and }) =>
        and(eq(eventId, event.id), eq(meetingStartTime, new Date(startTime))),
    });

    return NextResponse.json({
      status: meeting ? 'created' : 'pending',
      meeting: meeting ? { id: meeting.id } : null,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error checking meeting status', { error });
    return NextResponse.json({ error: 'Failed to check meeting status' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ message: 'Method not implemented' }, { status: 501 });
}
