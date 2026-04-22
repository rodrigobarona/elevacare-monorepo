import { isUserExpert } from '@/lib/integrations/workos/roles';
import { markStepComplete } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

import { BillingPageClient } from './billing-client';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

/**
 * Billing Page - AuthKit Implementation
 *
 * Experts can manage Stripe Connect account and payouts.
 * Uses AuthKit session for authentication and access token for API calls.
 */
export default async function BillingPage() {
  // Require authentication - auto-redirects if not logged in
  const { user, accessToken } = await withAuth({ ensureSignedIn: true });

  // Check if user has expert role, redirect if not
  if (!(await isUserExpert(user.id))) {
    return redirect('/dashboard');
  }

  try {
    // Use AuthKit access token for API authentication
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/user/billing`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to load billing data');
    }

    const data = await response.json();

    if (!data || !data.user) {
      return (
        <div className="container flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">No billing data available.</p>
        </div>
      );
    }

    // If Stripe Connect account is set up, mark the payment step as complete
    if (
      data.user.stripeConnectAccountId &&
      data.accountStatus?.detailsSubmitted &&
      data.accountStatus?.payoutsEnabled
    ) {
      // Mark payment step as complete (non-blocking)
      markStepComplete('payment').catch((error) => {
        console.error('Failed to mark payment step as complete:', error);
      });
    }

    return <BillingPageClient dbUser={data.user} accountStatus={data.accountStatus} />;
  } catch {
    return (
      <div className="container flex min-h-[400px] items-center justify-center">
        <p className="text-destructive">Failed to load billing data. Please try again later.</p>
      </div>
    );
  }
}
