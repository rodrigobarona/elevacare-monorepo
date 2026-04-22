import { db } from '@/drizzle/db';
import { EventsTable, MeetingsTable } from '@/drizzle/schema';
import { isExpert } from '@/lib/auth/roles.server';
import { findEmailByCustomerId } from '@/lib/utils/customerUtils';
import { withAuth } from '@workos-inc/authkit-nextjs';
import * as Sentry from '@sentry/nextjs';
import { and, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * GET handler for individual customer details by secure ID
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { user } = await withAuth();
  const userId = user?.id;
    const customerId = params.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify expert role
    const userIsExpert = await isExpert();
    if (!userIsExpert) {
      return NextResponse.json({ error: 'Forbidden: Expert role required' }, { status: 403 });
    }

    // First, get all customers for this expert to find the matching ID
    const allCustomersQuery = db
      .select({
        email: MeetingsTable.guestEmail,
        name: MeetingsTable.guestName,
      })
      .from(MeetingsTable)
      .innerJoin(EventsTable, eq(EventsTable.id, MeetingsTable.eventId))
      .where(eq(EventsTable.workosUserId, userId))
      .groupBy(MeetingsTable.guestEmail, MeetingsTable.guestName);

    const allCustomers = await allCustomersQuery;

    // Find the customer email that matches the provided ID using the shared utility
    const customerEmails = allCustomers.map((customer) => customer.email);
    const customerEmail = findEmailByCustomerId(userId, customerId, customerEmails);

    if (!customerEmail) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Now get all appointments for this customer
    const appointments = await db
      .select({
        id: MeetingsTable.id,
        guestName: MeetingsTable.guestName,
        guestEmail: MeetingsTable.guestEmail,
        startTime: MeetingsTable.startTime,
        endTime: MeetingsTable.endTime,
        timezone: MeetingsTable.timezone,
        guestNotes: MeetingsTable.guestNotes,
        meetingUrl: MeetingsTable.meetingUrl,
        stripePaymentStatus: MeetingsTable.stripePaymentStatus,
        stripePaymentIntentId: MeetingsTable.stripePaymentIntentId,
        stripeTransferStatus: MeetingsTable.stripeTransferStatus,
        eventName: EventsTable.name,
        amount: EventsTable.price,
      })
      .from(MeetingsTable)
      .innerJoin(EventsTable, eq(EventsTable.id, MeetingsTable.eventId))
      .where(and(eq(EventsTable.workosUserId, userId), eq(MeetingsTable.guestEmail, customerEmail)))
      .orderBy(desc(MeetingsTable.startTime));

    if (appointments.length === 0) {
      return NextResponse.json({ error: 'Customer has no appointments' }, { status: 404 });
    }

    // Calculate total spend
    const totalSpend = appointments.reduce(
      (sum, appointment) => sum + (appointment.amount || 0),
      0,
    );

    // Create customer object with secure ID
    const customer = {
      id: customerId, // Use the provided secure ID
      email: customerEmail,
      name: appointments[0].guestName || '',
      stripeCustomerId: appointments[0]?.stripePaymentIntentId
        ? `cus_${appointments[0].stripePaymentIntentId.substring(3, 11)}`
        : null,
      totalSpend,
      appointmentsCount: appointments.length,
      lastAppointment: appointments[0]?.startTime || null,
      appointments,
      notes: '', // This could be fetched from a separate notes table if you have one
      createdAt: appointments[appointments.length - 1]?.startTime || new Date().toISOString(),
    };

    return NextResponse.json({ customer });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching customer details', { error });
    return NextResponse.json({ error: 'Failed to fetch customer details' }, { status: 500 });
  }
}
