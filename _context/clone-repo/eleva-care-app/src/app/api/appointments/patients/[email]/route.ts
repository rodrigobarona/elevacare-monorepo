import { db } from '@/drizzle/db';
import { MeetingsTable } from '@/drizzle/schema';
import { withAuth } from '@workos-inc/authkit-nextjs';
import * as Sentry from '@sentry/nextjs';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

const emailParamSchema = z.string().email();

export async function GET(request: Request, props: { params: Promise<{ email: string }> }) {
  const params = await props.params;
  try {
    const { user } = await withAuth();
    const userId = user?.id;
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailResult = emailParamSchema.safeParse(decodeURIComponent(params.email));
    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Invalid email format', details: emailResult.error.flatten() },
        { status: 400 },
      );
    }
    const email = emailResult.data;
    const appointments = await db.query.MeetingsTable.findMany({
      where: and(eq(MeetingsTable.workosUserId, userId), eq(MeetingsTable.guestEmail, email)),
      orderBy: (meetings) => [meetings.startTime],
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching patient appointments', { error });
    return NextResponse.json({ error: 'Failed to fetch patient appointments' }, { status: 500 });
  }
}
