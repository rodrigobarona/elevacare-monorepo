import { db, invalidateCache } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema';
import {
  getOrCreateStripeCustomer,
  getServerStripe,
  syncStripeDataToKV,
} from '@/lib/integrations/stripe';
import { getFullUserByWorkosId } from '@/server/db/users';
import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

const { logger } = Sentry;

export async function ensureUserStripeCustomer(user: typeof UsersTable.$inferSelect) {
  return Sentry.withServerActionInstrumentation('ensureUserStripeCustomer', { recordResponse: true }, async () => {
    if (user.stripeCustomerId) {
      await syncStripeDataToKV(user.stripeCustomerId);
      return user.stripeCustomerId;
    }

    logger.info('Creating Stripe customer', { userId: user.id, email: user.email });

    const customerId = await getOrCreateStripeCustomer(user.id, user.email, undefined);

    await db
      .update(UsersTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(UsersTable.id, user.id));

    if (user.workosUserId) {
      await invalidateCache([`user-${user.workosUserId}`, `user-full-${user.workosUserId}`]);
    }

    logger.info('Created Stripe customer', { userId: user.id, customerId });
    return customerId;
  });
}

export async function updateStripeCustomerEmail(customerId: string, email: string) {
  return Sentry.withServerActionInstrumentation('updateStripeCustomerEmail', { recordResponse: true }, async () => {
    try {
      const stripe = await getServerStripe();
      const customer = await stripe.customers.retrieve(customerId);

      if ('deleted' in customer && customer.deleted) {
        logger.error('Tried to update deleted customer', { customerId });
        return null;
      }

      if (customer.email === email) return customer;

      logger.info('Updating Stripe customer email', { customerId, oldEmail: customer.email, newEmail: email });
      return await stripe.customers.update(customerId, { email });
    } catch (error) {
      logger.error('Error updating Stripe customer email', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  });
}

/**
 * Ensure user is fully synchronized across DB and Stripe.
 * Call at critical application entry points (login, billing page, etc.).
 */
export async function ensureFullUserSynchronization(workosUserId: string) {
  return Sentry.withServerActionInstrumentation('ensureFullUserSynchronization', { recordResponse: true }, async () => {
    const dbUser = await getFullUserByWorkosId(workosUserId);
    if (!dbUser) {
      logger.error('User not found in database', { workosUserId });
      return null;
    }

    if (dbUser.stripeCustomerId) {
      try {
        const stripe = await getServerStripe();
        const customer = await stripe.customers.retrieve(dbUser.stripeCustomerId);

        if ('deleted' in customer && customer.deleted) {
          logger.info('Stripe customer was deleted, recreating', { workosUserId });
          const newCustomerId = await ensureUserStripeCustomer({
            ...dbUser,
            stripeCustomerId: null,
          });
          if (newCustomerId) {
            await db
              .update(UsersTable)
              .set({ stripeCustomerId: newCustomerId, updatedAt: new Date() })
              .where(eq(UsersTable.id, dbUser.id));
            await invalidateCache([`user-${workosUserId}`, `user-full-${workosUserId}`]);
            dbUser.stripeCustomerId = newCustomerId;
          }
        } else {
          if (dbUser.email) {
            await updateStripeCustomerEmail(dbUser.stripeCustomerId, dbUser.email);
          }
          await syncStripeDataToKV(dbUser.stripeCustomerId);
        }
      } catch (error) {
        logger.error('Error retrieving Stripe customer', { error: error instanceof Error ? error.message : String(error) });
        if (dbUser.email) {
          const newCustomerId = await ensureUserStripeCustomer({ ...dbUser, stripeCustomerId: null });
          if (newCustomerId) {
            await db
              .update(UsersTable)
              .set({ stripeCustomerId: newCustomerId, updatedAt: new Date() })
              .where(eq(UsersTable.id, dbUser.id));
            await invalidateCache([`user-${workosUserId}`, `user-full-${workosUserId}`]);
            dbUser.stripeCustomerId = newCustomerId;
          }
        }
      }
    } else if (dbUser.email) {
      const customerId = await ensureUserStripeCustomer(dbUser);
      if (customerId) {
        dbUser.stripeCustomerId = customerId;
      }
    }

    return dbUser;
  });
}

export async function syncWorkOSProfileToDatabase(workosUserId: string): Promise<boolean> {
  return Sentry.withServerActionInstrumentation('syncWorkOSProfileToDatabase', { recordResponse: true }, async () => {
    try {
      const { getWorkOSUserById, syncUserProfileData } = await import(
        '@/lib/integrations/workos/sync'
      );

      logger.info('Syncing profile data from WorkOS', { workosUserId });

      const workosUser = await getWorkOSUserById(workosUserId);
      if (!workosUser) {
        logger.error('User not found in WorkOS', { workosUserId });
        return false;
      }

      await syncUserProfileData({
        id: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName,
        lastName: workosUser.lastName,
        emailVerified: workosUser.emailVerified,
        profilePictureUrl: workosUser.profilePictureUrl,
      });

      logger.info('Profile data synced', { email: workosUser.email });
      return true;
    } catch (error) {
      logger.error('Error syncing profile data', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  });
}
