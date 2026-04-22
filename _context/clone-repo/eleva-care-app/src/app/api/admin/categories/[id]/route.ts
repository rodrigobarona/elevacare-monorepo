import { db } from '@/drizzle/db';
import { CategoriesTable } from '@/drizzle/schema';
import { isAdmin } from '@/lib/auth/roles.server';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

/** Zod schema for category update */
const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const parsed = categoryUpdateSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
      image: formData.get('image'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }

    const { name, description, image } = parsed.data;

    const updatedCategory = (await db
      .update(CategoriesTable)
      .set({
        name,
        description: description || null,
        image: image || null,
        updatedAt: new Date(),
      })
      .where(eq(CategoriesTable.id, params.id))
      .returning()) as Array<typeof CategoriesTable.$inferSelect>;

    if (!updatedCategory.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(updatedCategory[0]);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating category', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user } = await withAuth();
    const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // First check if there are any subcategories
    const subcategories = await db
      .select()
      .from(CategoriesTable)
      .where(eq(CategoriesTable.parentId, params.id));

    if (subcategories.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with subcategories. Delete subcategories first.' },
        { status: 400 },
      );
    }

    const deletedCategory = (await db
      .delete(CategoriesTable)
      .where(eq(CategoriesTable.id, params.id))
      .returning()) as Array<typeof CategoriesTable.$inferSelect>;

    if (!deletedCategory.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(deletedCategory[0]);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error deleting category', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

// Make this route handler dynamic
