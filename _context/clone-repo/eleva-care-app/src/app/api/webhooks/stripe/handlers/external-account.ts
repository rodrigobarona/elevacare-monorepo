import { db } from '@/drizzle/db';
import { ProfilesTable, UsersTable } from '@/drizzle/schema';
import { NOTIFICATION_TYPE_ACCOUNT_UPDATE } from '@/lib/constants/notifications';
import { withRetry } from '@/lib/integrations/stripe';
import { createUserNotification } from '@/lib/notifications/core';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import type { Stripe } from 'stripe';

const { logger } = Sentry;

export async function handleExternalAccountCreated(
  externalAccount: Stripe.BankAccount | Stripe.Card,
  accountId: string,
) {
  logger.info('External account added', { externalAccountId: externalAccount.id });

  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.stripeConnectAccountId, accountId),
  });

  if (!user) {
    logger.error('User not found for Connect account', { accountId });
    return;
  }

  // Fetch user profile for name (firstName/lastName are in ProfilesTable, not UsersTable)
  const profile = await db.query.ProfilesTable.findFirst({
    where: eq(ProfilesTable.workosUserId, user.workosUserId),
  });

  // Create notification for the user with retry
  try {
    await withRetry(
      async () => {
        await db.transaction(async (_tx) => {
          await createUserNotification({
            userId: user.id,
            type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
            data: {
              userName: profile?.firstName || user.username || 'User',
              title:
                externalAccount.object === 'bank_account' ? 'Bank Account Added' : 'Card Added',
              message:
                externalAccount.object === 'bank_account'
                  ? 'Your bank account has been successfully added to your Stripe Connect account.'
                  : 'Your card has been successfully added to your Stripe Connect account.',
              actionUrl: '/account/connect',
            },
          });
        });
      },
      3,
      1000,
    );
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error creating notification after retries', { error });
  }
}

export async function handleExternalAccountDeleted(
  externalAccount: Stripe.BankAccount | Stripe.Card,
  accountId: string,
) {
  try {
    logger.info('External account removed', { externalAccountId: externalAccount.id });

    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.stripeConnectAccountId, accountId),
    });

    if (!user) {
      logger.error('User not found for Connect account', { accountId });
      return;
    }

    const profile = await db.query.ProfilesTable.findFirst({
      where: eq(ProfilesTable.workosUserId, user.workosUserId),
    });

    await db.transaction(async (_tx) => {
      await createUserNotification({
        userId: user.id,
        type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
        data: {
          userName: profile?.firstName || user.username || 'User',
          title: externalAccount.object === 'bank_account' ? 'Bank Account Removed' : 'Card Removed',
          message:
            externalAccount.object === 'bank_account'
              ? 'A bank account has been removed from your Stripe Connect account.'
              : 'A card has been removed from your Stripe Connect account.',
          actionUrl: '/account/connect',
        },
      });
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error handling external account deletion', { error });
  }
}
