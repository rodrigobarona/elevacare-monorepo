import { getFullUserByWorkosId } from '@/server/db/users';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Drizzle query-level cache (.$withCache) handles caching in getFullUserByWorkosId
    const dbUser = await getFullUserByWorkosId(userId);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userProfile = {
      id: dbUser.id,
      workosUserId: userId,
      email: user.email || dbUser.email,
      username: dbUser.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: dbUser.imageUrl || user.profilePictureUrl || null,
      country: dbUser.country || 'PT',
      stripeCustomerId: dbUser.stripeCustomerId,
      stripeConnectAccountId: dbUser.stripeConnectAccountId,
    };

    return NextResponse.json({ user: userProfile });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching user profile', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
