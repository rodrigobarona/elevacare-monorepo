import { db } from '@/drizzle/db';
import { EventsTable } from '@/drizzle/schema';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { and, eq } from 'drizzle-orm';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

// Create a client-side only wrapper component
const ClientEventFormWrapper = dynamic(() =>
  import('@/components/features/forms/EventFormWrapper').then((mod) => mod.EventFormWrapper),
);

/**
 * Edit Event Page - AuthKit Implementation
 *
 * Allows experts to edit their existing events.
 * Authentication handled by withAuth().
 */
export default async function EditEventPage(props: { params: Promise<{ eventSlug: string }> }) {
  const params = await props.params;
  const { eventSlug } = params;

  // Require authentication - auto-redirects if not logged in
  const { user } = await withAuth({ ensureSignedIn: true });

  // Fetch event owned by current user
  const event = await db.query.EventsTable.findFirst({
    where: and(eq(EventsTable.workosUserId, user.id), eq(EventsTable.slug, eventSlug)),
  });

  if (event == null) {
    return notFound();
  }

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Edit Event</h2>
        <p className="text-muted-foreground">
          Make changes to your event settings and information.
        </p>
      </div>
      <ClientEventFormWrapper event={event} />
    </div>
  );
}
