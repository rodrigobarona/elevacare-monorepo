import { db } from '@/drizzle/db';
import { PaymentTransfersTable } from '@/drizzle/schema';
import { hasRole } from '@/lib/auth/roles.server';
import {
  PAYMENT_TRANSFER_STATUSES,
  type PaymentTransferStatus,
} from '@/lib/constants/payment-transfers';
import * as Sentry from '@sentry/nextjs';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { and, asc, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const { logger } = Sentry;

/** Zod schema for transfer update request */
const patchTransferSchema = z.object({
  transferId: z.number({ error: 'Transfer ID is required' }),
  requiresApproval: z.boolean().optional(),
  adminNotes: z.string().optional(),
});

// Define valid filter parameters
type FilterParams = {
  status?: string;
  expertId?: string;
  startDate?: string;
  endDate?: string;
  eventId?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

/**
 * GET endpoint to list and filter payment transfers
 * This can only be used by administrators
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters: FilterParams = {
      status: searchParams.get('status') || undefined,
      expertId: searchParams.get('expertId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      eventId: searchParams.get('eventId') || undefined,
      sortBy: searchParams.get('sortBy') || 'scheduledTransferTime',
      sortDirection: (searchParams.get('sortDirection') as 'asc' | 'desc') || 'desc',
      page: Number.parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(Number.parseInt(searchParams.get('limit') || '20', 10), 50), // Cap at 50
    };

    // Build query conditions
    const conditions = [];

    if (filters.status) {
      if (!PAYMENT_TRANSFER_STATUSES.includes(filters.status as PaymentTransferStatus)) {
        return NextResponse.json(
          {
            error: 'Invalid status format',
            details: `Valid statuses are: ${PAYMENT_TRANSFER_STATUSES.join(', ')}`,
          },
          { status: 400 },
        );
      }
      conditions.push(eq(PaymentTransfersTable.status, filters.status as PaymentTransferStatus));
    }

    if (filters.expertId) {
      conditions.push(eq(PaymentTransfersTable.expertWorkosUserId, filters.expertId));
    }

    if (filters.eventId) {
      conditions.push(like(PaymentTransfersTable.eventId, `%${filters.eventId}%`));
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      if (!Number.isNaN(startDate.getTime())) {
        conditions.push(gte(PaymentTransfersTable.scheduledTransferTime, startDate));
      }
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      if (!Number.isNaN(endDate.getTime())) {
        conditions.push(lte(PaymentTransfersTable.scheduledTransferTime, endDate));
      }
    }

    // Calculate pagination
    const offset = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);

    // Get count of total records matching filter
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(PaymentTransfersTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const totalCount = countResult[0]?.count || 0;

    // Determine sort column and direction
    const getSortColumn = () => {
      switch (filters.sortBy) {
        case 'amount':
          return PaymentTransfersTable.amount;
        case 'created':
          return PaymentTransfersTable.created;
        case 'status':
          return PaymentTransfersTable.status;
        case 'sessionStartTime':
          return PaymentTransfersTable.sessionStartTime;
        default:
          return PaymentTransfersTable.scheduledTransferTime;
      }
    };

    // Get paginated results with sorting
    const transfers = await db.query.PaymentTransfersTable.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: filters.sortDirection === 'asc' ? asc(getSortColumn()) : desc(getSortColumn()),
      offset,
      limit: filters.limit,
    });

    return NextResponse.json({
      data: transfers,
      pagination: {
        total: totalCount,
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        totalPages: Math.ceil(totalCount / (filters.limit ?? 20)),
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching payment transfers', { error });
    return NextResponse.json(
      { error: 'Failed to fetch payment transfers', details: (error as Error).message },
      { status: 500 },
    );
  }
}

/**
 * PATCH endpoint to update a payment transfer
 * This can only be used by administrators
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isSuperAdmin = await hasRole(WORKOS_ROLES.SUPERADMIN);
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = user.id;

    // Get transfer ID and update data from request body
    const body = await request.json();
    const parseResult = patchTransferSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { transferId, requiresApproval, adminNotes } = parseResult.data;

    // Check if the transfer exists
    const transfer = await db.query.PaymentTransfersTable.findFirst({
      where: eq(PaymentTransfersTable.id, transferId),
    });

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Only allow updates to certain fields
    const updates: Record<string, unknown> = {
      updated: new Date(),
      adminUserId: userId,
    };

    if (typeof requiresApproval === 'boolean') {
      updates.requiresApproval = requiresApproval;
    }

    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes;
    }

    // Update the transfer
    await db
      .update(PaymentTransfersTable)
      .set(updates)
      .where(eq(PaymentTransfersTable.id, transferId));

    logger.info(logger.fmt`Admin ${userId} updated transfer ${transferId}`);

    return NextResponse.json({
      success: true,
      message: 'Transfer updated successfully',
      transferId,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating transfer', { error });
    return NextResponse.json(
      { error: 'Failed to update transfer', details: (error as Error).message },
      { status: 500 },
    );
  }
}
