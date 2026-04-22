import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

const putSecurityPreferencesSchema = z.object({
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      language: z.enum(['en', 'es', 'pt', 'br']).optional(),
    })
    .strict(),
});

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'pt' | 'br';
}

/**
 * GET /api/user/security-preferences
 * Get the current user's preferences (theme, language, security alerts)
 *
 * NOTE: Preferences are now stored directly in the users table.
 * Notification preferences are managed by Novu Inbox widget.
 */
export async function GET() {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, user.id),
      columns: {
        theme: true,
        language: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const preferences: UserPreferences = {
      theme: dbUser.theme,
      language: dbUser.language,
    };

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching user preferences', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/security-preferences
 * Update the current user's UI preferences (theme, language)
 *
 * NOTE: Notification/security preferences are managed by WorkOS AuthKit and Novu
 */
export async function PUT(req: NextRequest) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = putSecurityPreferencesSchema.safeParse(await req.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const preferences = bodyResult.data.preferences;

    const updateData: Partial<{
      theme: 'light' | 'dark' | 'system';
      language: 'en' | 'es' | 'pt' | 'br';
      updatedAt: Date;
    }> = {
      ...preferences,
      updatedAt: new Date(),
    };

    await db.update(UsersTable).set(updateData).where(eq(UsersTable.workosUserId, user.id));

    // Fetch updated preferences
    const dbUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, user.id),
      columns: {
        theme: true,
        language: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: dbUser
        ? {
            theme: dbUser.theme,
            language: dbUser.language,
          }
        : preferences,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating user preferences', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
