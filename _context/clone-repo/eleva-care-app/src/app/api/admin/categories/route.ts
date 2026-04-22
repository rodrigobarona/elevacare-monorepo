import { db } from '@/drizzle/db';
import { CategoriesTable } from '@/drizzle/schema';
import { isAdmin } from '@/lib/auth/roles.server';
import type { ApiResponse } from '@/types/api';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

/** Zod schema for category creation/update */
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

/**
 * GET - List all categories
 *
 * Note: Admin authorization is handled by the proxy middleware
 */
export async function GET() {
  // Defense-in-depth: verify auth even though proxy should enforce this
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ApiResponse<null>, {
      status: 401,
    });
  }

  try {
    const categories = await db.select().from(CategoriesTable);
    return NextResponse.json({
      success: true,
      data: categories,
    } as ApiResponse<unknown[]>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching categories', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Error fetching categories',
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

/**
 * POST - Create a new category
 *
 * Note: Admin authorization is handled by the proxy middleware
 */
export async function POST(request: Request) {
  // Defense-in-depth: verify admin even though proxy should enforce this
  let user: Awaited<ReturnType<typeof withAuth>>['user'];
  try {
    const authResult = await withAuth();
    user = authResult.user;
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Auth error in category creation', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      } as ApiResponse<null>,
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' } as ApiResponse<null>, {
      status: 401,
    });
  }

  let isUserAdmin: boolean;
  try {
    isUserAdmin = await isAdmin();
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Role check error in category creation', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Role verification failed',
      } as ApiResponse<null>,
      { status: 500 },
    );
  }

  if (!isUserAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' } as ApiResponse<null>, {
      status: 403,
    });
  }

  // 🛡️ BotID Protection: Check for bot traffic before admin operations
  const botVerification = (await checkBotId({
    advancedOptions: {
      checkLevel: 'basic',
    },
  })) as import('@/types/botid').BotIdVerificationResult;

  if (botVerification.isBot && !botVerification.isVerifiedBot) {
    logger.warn('Bot detected in admin category creation', {
      isVerifiedBot: botVerification.isVerifiedBot,
      verifiedBotName: botVerification.verifiedBotName,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Access denied',
        message: 'Automated admin operations are not allowed',
      },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const parsed = categorySchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
      image: formData.get('image'),
      parentId: formData.get('parentId'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Validation failed',
        } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const { name, description, image, parentId } = parsed.data;

    const newCategory = (await db
      .insert(CategoriesTable)
      .values({
        name,
        description: description || null,
        image: image || null,
        parentId: parentId === 'null' ? null : parentId || null,
      })
      .returning()) as Array<typeof CategoriesTable.$inferSelect>;

    return NextResponse.json({
      success: true,
      data: newCategory[0],
    } as ApiResponse<(typeof newCategory)[0]>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error creating category', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
