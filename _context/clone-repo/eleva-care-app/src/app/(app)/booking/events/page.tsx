import { EventsList } from '@/components/features/booking/EventsList';
import { db } from '@/drizzle/db';
import { EventsTable, UsersTable } from '@/drizzle/schema';
import { markStepComplete } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

/**
 * Events List Page - WorkOS Implementation
 *
 * Lists all events for the authenticated expert.
 * Automatically marks the 'events' setup step as complete when an active event exists.
 * Uses username from UsersTable for booking URLs.
 */
export default async function EventsPage() {
  // Require authentication - auto-redirects if not logged in
  const { user } = await withAuth({ ensureSignedIn: true });

  // Parallel fetch user data and events
  const [dbUser, events] = await Promise.all([
    db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, user.id),
      columns: {
        username: true,
        id: true,
      },
    }),
    db.query.EventsTable.findMany({
      where: eq(EventsTable.workosUserId, user.id),
      orderBy: (events, { asc }) => [asc(events.order)],
    }),
  ]);

  // Use username from UsersTable, fallback to user ID if not set
  const username = dbUser?.username || user.id;

  // Check if the expert has at least one published event
  if (events.some((event: { isActive: boolean }) => event.isActive)) {
    // Mark events step as complete (non-blocking)
    try {
      await markStepComplete('events');
    } catch (error) {
      console.error('Failed to mark events step as complete:', error);
    }
  }

  return <EventsList initialEvents={events} username={username} />;
}
