import { db } from '@/drizzle/db';
import { EventsTable, MeetingsTable } from '@/drizzle/schema';
import { isExpert } from '@/lib/auth/roles.server';
import { generateCustomerId } from '@/lib/utils/customerUtils';
import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const { logger } = Sentry;

/**
 * GET handler for the /api/customers endpoint
 * Returns a list of customers for the logged-in expert
 */
export async function GET() {
  try {
    const { user } = await withAuth();
  const userId = user?.id;

    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify expert role
    const userIsExpert = await isExpert();
    if (!userIsExpert) {
      return NextResponse.json({ error: 'Forbidden: Expert role required' }, { status: 403 });
    }

    // Find all unique customers who have booked appointments with this expert
    const customersWithAppointmentsQuery = db
      .select({
        email: MeetingsTable.guestEmail,
        name: MeetingsTable.guestName,
        // Count appointments per customer
        appointmentsCount: sql<number>`count(${MeetingsTable.id})`.as('appointment_count'),
        // Calculate total spend
        totalSpend: sql<number>`sum(${EventsTable.price})`.as('total_spend'),
        // Get most recent appointment date
        lastAppointment: sql<string>`max(${MeetingsTable.startTime})`.as('last_appointment'),
        // Get first appointment to calculate customer since date
        firstAppointment: sql<string>`min(${MeetingsTable.startTime})`.as('first_appointment'),
      })
      .from(MeetingsTable)
      .innerJoin(EventsTable, eq(EventsTable.id, MeetingsTable.eventId))
      .where(eq(EventsTable.workosUserId, userId))
      .groupBy(MeetingsTable.guestEmail, MeetingsTable.guestName)
      .orderBy(desc(sql`last_appointment`));

    const customersWithAppointments = await customersWithAppointmentsQuery;

    // Format the response with secure customer IDs
    const customers = customersWithAppointments.map((customer) => {
      // Create a secure, deterministic customer ID based on email hash and expert ID
      // This ensures consistent IDs without exposing email directly
      const customerId = generateCustomerId(userId, customer.email);

      return {
        id: customerId, // Secure, non-email-based ID
        email: customer.email,
        name: customer.name,
        appointmentsCount: customer.appointmentsCount,
        totalSpend: customer.totalSpend || 0,
        lastAppointment: customer.lastAppointment,
        firstAppointment: customer.firstAppointment,
        stripeCustomerId: null, // We don't have a way to get this without PaymentIntentTable
      };
    });

    return NextResponse.json({ customers });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching customers', { error });
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
