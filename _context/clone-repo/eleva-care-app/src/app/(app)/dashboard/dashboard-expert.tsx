'use client';

import { ConnectNotificationBanner } from '@stripe/react-connect-js';
import { StripeConnectProvider } from '@/components/stripe/StripeConnectProvider';
import type { DashboardMeeting, ExpertEarnings, ExpertStats } from '@/server/actions/dashboard';
import type { SetupStatus } from '@/types/expert-setup';
import { Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { EarningsOverview } from './components/earnings-overview';
import { ExpertSetupProgress } from './components/expert-setup-progress';
import { QuickActions } from './components/quick-actions';
import { RecentSessions } from './components/recent-sessions';
import { StatCard } from './components/stat-card';
import { UpcomingAppointments } from './components/upcoming-appointments';

const StripeFinancialDashboard = lazy(() =>
  import('./components/stripe-financial-dashboard').then((m) => ({
    default: m.StripeFinancialDashboard,
  })),
);

interface ExpertDashboardProps {
  firstName: string;
  setupStatus: SetupStatus;
  isSetupComplete: boolean;
  isProfilePublished: boolean;
  hasStripeAccount: boolean;
  accountStatus: {
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null;
  stats: ExpertStats;
  earnings: ExpertEarnings;
  upcomingMeetings: DashboardMeeting[];
  recentMeetings: DashboardMeeting[];
}

function formatCurrency(amountInCents: number, currency = 'eur') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

function StripeNotificationBanner() {
  return (
    <StripeConnectProvider>
      <ConnectNotificationBanner
        collectionOptions={{
          fields: 'eventually_due',
          futureRequirements: 'include',
        }}
        onLoaderStart={() => {}}
        onLoadError={() => {}}
      />
    </StripeConnectProvider>
  );
}

export function ExpertDashboard({
  firstName,
  setupStatus,
  isSetupComplete,
  isProfilePublished,
  hasStripeAccount,
  accountStatus,
  stats,
  earnings,
  upcomingMeetings,
  recentMeetings,
}: ExpertDashboardProps) {
  const isFullyOnboarded = accountStatus?.chargesEnabled && accountStatus?.payoutsEnabled;
  const showFinancials = hasStripeAccount && isFullyOnboarded;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {firstName}!</h1>
        <p className="mt-1 text-muted-foreground">
          {isSetupComplete
            ? 'Your practice at a glance'
            : "Let's get your practice up and running"}
        </p>
      </div>

      {hasStripeAccount && (
        <StripeNotificationBanner />
      )}

      {!isSetupComplete && (
        <ExpertSetupProgress
          setupStatus={setupStatus}
          isProfilePublished={isProfilePublished}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming Sessions"
          value={stats.upcomingSessions}
          icon={Calendar}
        />
        {showFinancials ? (
          <StatCard
            label="This Month"
            value={formatCurrency(earnings.monthlyNetEarnings, earnings.currency)}
            icon={DollarSign}
          />
        ) : (
          <StatCard
            label="Sessions This Month"
            value={stats.sessionsThisMonth}
            icon={TrendingUp}
          />
        )}
        <StatCard
          label="Total Patients"
          value={stats.uniquePatients}
          icon={Users}
        />
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions}
          icon={Calendar}
        />
      </div>

      <UpcomingAppointments meetings={upcomingMeetings} role="expert" />

      {showFinancials && (
        <div className="grid gap-6 lg:grid-cols-2">
          <EarningsOverview earnings={earnings} />
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                Loading financial dashboard...
              </div>
            }
          >
            <StripeFinancialDashboard />
          </Suspense>
        </div>
      )}

      <QuickActions role="expert" isSetupComplete={isSetupComplete} />

      <RecentSessions meetings={recentMeetings} role="expert" />
    </div>
  );
}
