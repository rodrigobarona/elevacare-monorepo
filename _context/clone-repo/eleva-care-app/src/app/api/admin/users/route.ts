import { db } from '@/drizzle/db';
import { RolesTable, UsersTable } from '@/drizzle/schema';
import { hasRole, updateUserRole } from '@/lib/auth/roles.server';
import type { ApiResponse, ApiUser } from '@/types/api';
import * as Sentry from '@sentry/nextjs';
import { WORKOS_ROLES, type WorkOSRole } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { desc, ilike, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

/** All valid WorkOS role values for Zod enum */
const VALID_ROLES = Object.values(WORKOS_ROLES) as [string, ...string[]];

/** Zod schema for role update request */
const updateRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(VALID_ROLES, { error: 'Invalid role specified' }),
});

const ITEMS_PER_PAGE = 10;

export async function GET(req: Request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        } as ApiResponse<null>,
        { status: 401 },
      );
    }

    // Verify admin role (only superadmin in WorkOS RBAC)
    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
    if (!isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
        } as ApiResponse<null>,
        { status: 403 },
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const page = Number.parseInt(url.searchParams.get('page') || '1');
    const search = url.searchParams.get('search') || '';

    // Build query conditions
    // Note: firstName/lastName removed from UsersTable (Phase 5)
    // Search by email only for now. Future: could search WorkOS API for name-based search
    const conditions = search ? ilike(UsersTable.email, `%${search}%`) : undefined;

    // Fetch users from database
    const users = await db
      .select({
        id: UsersTable.id,
        workosUserId: UsersTable.workosUserId,
        email: UsersTable.email,
        username: UsersTable.username,
        createdAt: UsersTable.createdAt,
      })
      .from(UsersTable)
      .where(conditions)
      .limit(ITEMS_PER_PAGE)
      .offset((page - 1) * ITEMS_PER_PAGE)
      .orderBy(desc(UsersTable.createdAt));

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(UsersTable)
      .where(conditions);

    // Fetch roles for each user
    const userIds = users.map((u) => u.workosUserId);
    const roles = await db
      .select({
        workosUserId: RolesTable.workosUserId,
        role: RolesTable.role,
      })
      .from(RolesTable)
      .where(sql`${RolesTable.workosUserId} = ANY(${userIds})`);

    // Map roles to users (take first/highest-priority role if multiple exist)
    const roleMap = new Map<string, WorkOSRole>();
    const multiRoleUsers: string[] = [];
    for (const role of roles) {
      if (roleMap.has(role.workosUserId)) {
        // User has multiple roles - log warning and keep the first one
        multiRoleUsers.push(role.workosUserId);
      } else {
        roleMap.set(role.workosUserId, role.role as WorkOSRole);
      }
    }

    // Log warning if any users have multiple roles (data inconsistency)
    if (multiRoleUsers.length > 0) {
      logger.warn('Users with multiple roles detected (using first role)', {
        multiRoleUsers,
      });
    }

    const formattedUsers: ApiUser[] = users.map((user) => ({
      id: user.workosUserId,
      email: user.email,
      // Use username or email for display (WorkOS API could be called here for full name if needed)
      name: user.username || user.email,
      role: roleMap.get(user.workosUserId) || WORKOS_ROLES.PATIENT,
    }));

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        total: Number(count),
      },
    } as ApiResponse<{ users: ApiUser[]; total: number }>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching users', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        } as ApiResponse<null>,
        { status: 401 },
      );
    }

    // Verify admin role (only superadmin can modify roles)
    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
    if (!isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
        } as ApiResponse<null>,
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ success: false, error: 'Malformed JSON' } as ApiResponse<null>, {
          status: 400,
        });
      }
      throw error;
    }

    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Validation failed',
        } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const { userId: targetUserId, role } = parsed.data;
    await updateUserRole(targetUserId, role as WorkOSRole);

    return NextResponse.json({
      success: true,
      message: `Role updated successfully to: ${role}`,
    } as ApiResponse<null>);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating user role', { error });
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
