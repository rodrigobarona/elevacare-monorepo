'use server';

import { db, invalidateCache } from '@/drizzle/db';
import * as Sentry from '@sentry/nextjs';
import { EventsTable, MeetingsTable } from '@/drizzle/schema';

const { logger } = Sentry;
import { getServerStripe } from '@/lib/integrations/stripe';
import { logAuditEvent } from '@/lib/utils/server/audit';
import { eventFormSchema } from '@/schema/events';
import { checkExpertSetupStatus, markStepComplete } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { checkBotId } from 'botid/server';
import { and, count, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';

/**
 * @fileoverview Server actions for managing events in the Eleva Care application.
 * This file handles the creation, updating, deletion, and management of events,
 * including validation, logging, and redirection.
 
 * Creates a new event using the provided data.
 *
 * @param unsafeData - The data for creating the event, validated against the eventFormSchema.
 * @returns A promise that resolves to an object with an error flag and an optional message on failure, or undefined on success.
 *
 * @example
 * const eventData = { /* event data conforming to eventFormSchema *\/ };
 * const result = await createEvent(eventData);
 * if (result?.error) {
 *   console.error('Event creation failed:', result.message);
 * }
 */
export async function createEvent(
  unsafeData: z.infer<typeof eventFormSchema>,
): Promise<{ error: boolean; message?: string } | undefined> {
  return Sentry.withServerActionInstrumentation('createEvent', { recordResponse: true }, async () => {
  // 🛡️ BotID Protection: Check for bot traffic before creating events
  const botVerification = (await checkBotId({
    advancedOptions: {
      checkLevel: 'basic',
    },
  })) as import('@/types/botid').BotIdVerificationResult;

  if (botVerification.isBot) {
    logger.warn('🚫 Bot detected in event creation', {
      isVerifiedBot: botVerification.isVerifiedBot,
      verifiedBotName: botVerification.verifiedBotName,
    });

    return {
      error: true,
      message: 'Automated event creation is not allowed',
    };
  }

  const { user } = await withAuth();
  const userId = user?.id;

  const { success, data } = eventFormSchema.safeParse(unsafeData);

  if (!success || userId == null) {
    return { error: true, message: 'Invalid form data' };
  }

  try {
    // Insert event and retrieve the generated ID
    const [insertedEvent] = await db
      .insert(EventsTable)
      .values({ ...data, workosUserId: userId })
      .returning({ id: EventsTable.id, userId: EventsTable.workosUserId });

    if (!insertedEvent) {
      return { error: true, message: 'Failed to create event' };
    }

    // Log the event creation (user context automatically extracted)
    await logAuditEvent('EVENT_CREATED', 'event', insertedEvent.id, {
      newValues: { ...data },
    });

    // If the event is marked as active, mark the events step as complete
    if (data.isActive) {
      try {
        await markStepComplete('events');
      } catch (error) {
        logger.error('Failed to mark events step as complete', { error });
      }
    }

    await invalidateCache([`expert-events-${userId}`]);

    // Return success instead of redirecting
    return { error: false };
  } catch (error) {
    logger.error('Create event error', { error });
    return { error: true, message: 'Database error occurred' };
  }
  });
}

/**
 * Updates an existing event with the given ID using the provided data.
 *
 * @param id - The unique identifier of the event to update.
 * @param unsafeData - The updated event data, validated against the eventFormSchema.
 * @returns A promise that resolves to an object with an error flag on failure, or undefined on success.
 *
 * @example
 * const updateData = { /* new event data *\/ };
 * const result = await updateEvent('event-id', updateData);
 * if (result?.error) {
 *   console.error('Event update failed');
 * }
 */
export async function updateEvent(
  id: string,
  unsafeData: z.infer<typeof eventFormSchema>,
): Promise<{ error: boolean } | undefined> {
  return Sentry.withServerActionInstrumentation('updateEvent', { recordResponse: true }, async () => {
  const { user } = await withAuth();
  const userId = user?.id;

  const { success, data } = eventFormSchema.safeParse(unsafeData);

  if (!success || userId == null) {
    return { error: true };
  }

  // Step 1: Retrieve old values before the update
  const [oldEvent] = await db
    .select()
    .from(EventsTable)
    .where(and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)))
    .execute(); // Ensure to execute the query to get the old values

  if (!oldEvent) {
    return { error: true }; // Event not found
  }

  // Step 2: Update the event with new values
  const [updatedEvent] = await db
    .update(EventsTable)
    .set({ ...data })
    .where(and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)))
    .returning({ id: EventsTable.id, userId: EventsTable.workosUserId });

  if (!updatedEvent) {
    return { error: true };
  }

  // Log the event update (user context automatically extracted)
  await logAuditEvent('EVENT_UPDATED', 'event', updatedEvent.id, {
    oldValues: oldEvent as Record<string, unknown>,
    newValues: { ...data },
  });

  // If the event is active, mark the events step as complete
  if (data.isActive) {
    try {
      await markStepComplete('events');
    } catch (error) {
      logger.error('Failed to mark events step as complete', { error });
    }
  }

  // After update, refresh the expert setup status
  await checkExpertSetupStatus();

  await invalidateCache([`expert-events-${userId}`]);

  redirect('/booking/events');
  });
}

/**
 * Deletes the event with the specified ID.
 *
 * @param id - The unique identifier of the event to delete.
 * @returns A promise that resolves to an object with an error flag on failure, or undefined on success.
 *
 * @example
 * const result = await deleteEvent('event-id');
 * if (result?.error) {
 *   console.error('Failed to delete the event');
 * }
 */
export async function deleteEvent(id: string): Promise<{ error: boolean } | undefined> {
  return Sentry.withServerActionInstrumentation('deleteEvent', { recordResponse: true }, async () => {
  const { user } = await withAuth();
  const userId = user?.id;

  if (userId == null) {
    return { error: true };
  }

  try {
    // Step 1: Retrieve old values before deletion
    const [oldEvent] = await db
      .select()
      .from(EventsTable)
      .where(and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)))
      .execute();

    if (!oldEvent) {
      return { error: true }; // Event not found
    }

    // Step 2: If there's a Stripe product, archive it
    if (oldEvent.stripeProductId) {
      try {
        const stripe = await getServerStripe();
        await stripe.products.update(oldEvent.stripeProductId, {
          active: false,
        });
      } catch (stripeError) {
        logger.error('Failed to archive Stripe product', { error: stripeError });
        // Continue with event deletion even if Stripe archival fails
      }
    }

    // Step 3: Delete the event
    const [deletedEvent] = await db
      .delete(EventsTable)
      .where(and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)))
      .returning({ id: EventsTable.id, userId: EventsTable.workosUserId });

    if (!deletedEvent) {
      return { error: true };
    }

    // Log the event deletion (user context automatically extracted)
    await logAuditEvent(
      'EVENT_DELETED',
      'event',
      deletedEvent.id,
      {
        oldValues: oldEvent as Record<string, unknown>,
      },
      { reason: 'User requested deletion' },
    );

    updateTag('events');
    updateTag(`user-events-${userId}`);

    await invalidateCache([`expert-events-${userId}`]);

    // After deletion, check and update the expert setup status
    await checkExpertSetupStatus();

    return { error: false };
  } catch (error) {
    logger.error('Delete event error', { error });
    return { error: true };
  }
  });
}

/**
 * Updates the order of events based on the provided array of update objects.
 *
 * @param updates - An array of objects, each containing an event's ID and its new order.
 *
 * @example
 * await updateEventOrder([
 *   { id: 'event1', order: 1 },
 *   { id: 'event2', order: 2 }
 * ]);
 */
export async function updateEventOrder(updates: { id: string; order: number }[]) {
  return Sentry.withServerActionInstrumentation('updateEventOrder', { recordResponse: true }, async () => {
  try {
    // Update each record individually since we can't use transactions
    for (const { id, order } of updates) {
      await db.update(EventsTable).set({ order }).where(eq(EventsTable.id, id));
    }

    updateTag('events');
    return { success: true };
  } catch (error) {
    logger.error('Failed to update event order', { error });
    return { error: 'Failed to update event order' };
  }
  });
}

/**
 * Updates the active state of the event with the given ID.
 *
 * @param id - The unique identifier of the event.
 * @param isActive - A boolean indicating whether the event should be active (true) or inactive (false).
 * @returns A promise that resolves to an object with an error flag on failure, or undefined on success.
 *
 * @example
 * const result = await updateEventActiveState('event-id', true);
 * if (result?.error) {
 *   console.error('Failed to update the event active state');
 * }
 */
export async function updateEventActiveState(
  id: string,
  isActive: boolean,
): Promise<{ error: boolean } | undefined> {
  return Sentry.withServerActionInstrumentation('updateEventActiveState', { recordResponse: true }, async () => {
  const { user } = await withAuth();
  const userId = user?.id;

  if (!user || !userId) {
    return { error: true };
  }

  try {
    // Fetch the event to check ownership and log the previous state
    const event = await db.query.EventsTable.findFirst({
      where: and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)),
    });

    if (!event) {
      return { error: true };
    }

    // Update the event's active status
    await db
      .update(EventsTable)
      .set({ isActive })
      .where(and(eq(EventsTable.id, id), eq(EventsTable.workosUserId, userId)));

    // Log the update action (user context automatically extracted)
    await logAuditEvent(isActive ? 'EVENT_ACTIVATED' : 'EVENT_DEACTIVATED', 'event', id, {
      oldValues: { isActive: event.isActive },
      newValues: { isActive },
    });

    // If the event is being activated, mark the events step as complete
    if (isActive) {
      try {
        await markStepComplete('events');
      } catch (error) {
        logger.error('Failed to mark events step as complete', { error });
      }
    }

    updateTag('events');
    updateTag(`event-${id}`);
    updateTag(`user-events-${userId}`);

    await invalidateCache([`expert-events-${userId}`]);

    return { error: false };
  } catch (error) {
    logger.error('Update event active state error', { error });
    return { error: true };
  }
  });
}

export async function getEventMeetingsCount(eventId: string): Promise<number> {
  return Sentry.withServerActionInstrumentation('getEventMeetingsCount', { recordResponse: true }, async () => {
  const result = await db
    .select({ count: count() })
    .from(MeetingsTable)
    .where(eq(MeetingsTable.eventId, eventId));

  return result[0]?.count ?? 0;
  });
}
