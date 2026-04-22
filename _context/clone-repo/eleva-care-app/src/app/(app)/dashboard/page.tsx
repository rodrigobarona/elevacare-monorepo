import { db } from '@/drizzle/db';
import { ProfilesTable, UsersTable } from '@/drizzle/schema';
import { isUserExpert } from '@/lib/integrations/workos/roles';
import { getStripeConnectAccountStatus } from '@/lib/integrations/stripe/client';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import {
  getExpertEarnings,
  getExpertStats,
  getPatientStats,
  getRecentMeetings,
  getUpcomingMeetings,
} from '@/server/actions/dashboard';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';

import { ExpertDashboard } from './dashboard-expert';
import { PatientDashboard } from './dashboard-patient';

export default async function DashboardPage() {
  const { user } = await withAuth({ ensureSignedIn: true });
  const firstName = user.firstName || 'there';

  const isExpert = await isUserExpert(user.id);

  if (isExpert) {
    const [setupData, profile, dbUser, stats, earnings, upcomingMeetings, recentMeetings] =
      await Promise.all([
        checkExpertSetupStatus().catch(() => ({
          setupStatus: {
            profile: false,
            availability: false,
            events: false,
            identity: false,
            payment: false,
            google_account: false,
          },
          isSetupComplete: false,
          setupCompletedAt: null,
        })),
        db.query.ProfilesTable.findFirst({
          where: eq(ProfilesTable.workosUserId, user.id),
          columns: { published: true },
        }),
        db.query.UsersTable.findFirst({
          where: eq(UsersTable.workosUserId, user.id),
          columns: { stripeConnectAccountId: true },
        }),
        getExpertStats(user.id),
        getExpertEarnings(user.id),
        getUpcomingMeetings(user.id, 'expert', 5),
        getRecentMeetings(user.id, 'expert', 3),
      ]);

    let accountStatus: {
      detailsSubmitted: boolean;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
    } | null = null;

    if (dbUser?.stripeConnectAccountId) {
      try {
        accountStatus = await getStripeConnectAccountStatus(dbUser.stripeConnectAccountId);
      } catch {
        accountStatus = null;
      }
    }

    return (
      <div className="container max-w-6xl py-6">
        <ExpertDashboard
          firstName={firstName}
          setupStatus={setupData.setupStatus}
          isSetupComplete={setupData.isSetupComplete}
          isProfilePublished={profile?.published ?? false}
          hasStripeAccount={!!dbUser?.stripeConnectAccountId}
          accountStatus={accountStatus}
          stats={stats}
          earnings={earnings}
          upcomingMeetings={upcomingMeetings}
          recentMeetings={recentMeetings}
        />
      </div>
    );
  }

  // Patient dashboard
  const [patientStats, upcomingMeetings, recentMeetings] = await Promise.all([
    getPatientStats(user.id),
    getUpcomingMeetings(user.id, 'patient', 5),
    getRecentMeetings(user.id, 'patient', 3),
  ]);

  return (
    <div className="container max-w-6xl py-6">
      <PatientDashboard
        firstName={firstName}
        stats={patientStats}
        upcomingMeetings={upcomingMeetings}
        recentMeetings={recentMeetings}
      />
    </div>
  );
}
