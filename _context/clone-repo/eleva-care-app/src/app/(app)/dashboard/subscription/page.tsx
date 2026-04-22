import { SubscriptionDashboard } from '@/components/features/subscriptions/SubscriptionDashboard';
import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function SubscriptionPage() {
  await withAuth({ ensureSignedIn: true });

  // Only experts can access subscription page
  // TODO: Add proper role check based on user role from database
  // const { user } = await withAuth({ ensureSignedIn: true });
  // const userRecord = await db.query.UsersTable.findFirst(...);
  // if (!userRecord.role || !['expert_community', 'expert_top', 'expert_lecturer'].includes(userRecord.role)) {
  //   redirect('/dashboard');
  // }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your subscription plan and commission rates
        </p>
      </div>

      <SubscriptionDashboard />
    </div>
  );
}
