import { profileFormSchema } from '@/schema/profile';
import { updateProfile } from '@/server/actions/profile';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export async function POST(req: Request) {
  try {
    const { user } = await withAuth();
    const userId = user?.id;
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = profileFormSchema.safeParse(await req.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const result = await updateProfile(userId, bodyResult.data);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating profile', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
