'use client';

import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectDocuments,
  ConnectNotificationBanner,
  ConnectPayouts,
} from '@stripe/react-connect-js';
import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getMinimumPayoutDelay, STRIPE_CONNECT_SUPPORTED_COUNTRIES } from '@/config/stripe';
import { getCountryLabel } from '@/lib/constants/countries';
import { useUserProfile } from '@/hooks/use-user-profile';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { FileText, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { Suspense, useState } from 'react';
import { toast } from 'sonner';

import { StripeConnectProvider } from '@/components/stripe/StripeConnectProvider';

interface BillingPageClientProps {
  dbUser: {
    id: string;
    stripeConnectAccountId: string | null;
    stripeIdentityVerified: boolean;
  };
  accountStatus: {
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null;
}


function PaymentAgingInformation({
  userCountry,
  profileError,
}: {
  userCountry: string | null;
  profileError: Error | null;
}) {
  const getPayoutDelay = (country: string | null) => {
    if (!country) return getMinimumPayoutDelay('DEFAULT');
    return getMinimumPayoutDelay(country);
  };
  const payoutDelay = getPayoutDelay(userCountry);
  const country = userCountry || 'your country';

  return (
    <>
      <h4 className="mb-2 font-medium">Payout Schedule</h4>
      {profileError && (
        <Alert variant="default" className="mb-3">
          <Info className="h-4 w-4" />
          <AlertTitle>Country information unavailable</AlertTitle>
          <AlertDescription>
            We couldn&apos;t determine your country. Payout information shown may be using default
            values.
          </AlertDescription>
        </Alert>
      )}
      <p>
        For session payments, you&apos;ll receive your funds typically within 1-2 days after your
        session is completed, depending on when the booking was made and your location.
      </p>
      <div className="my-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        <h5 className="font-medium">How our payment aging system works:</h5>
        <ol className="ml-4 mt-1 list-decimal">
          <li>
            When a client books and pays for your session, that payment starts &quot;aging&quot;
            immediately
          </li>
          <li>
            Stripe requires payments to age for {payoutDelay} days in {country} before payout
          </li>
          <li>
            If a session is booked well in advance, the payment will already meet the aging
            requirement when your session occurs
          </li>
          <li>In this case, you&apos;ll receive funds just one day after completing your session</li>
          <li>
            For last-minute bookings, you&apos;ll need to wait for the remaining required days
            after your session
          </li>
        </ol>
      </div>
      <div className="my-3 rounded-md bg-muted p-3 text-sm">
        <h5 className="font-medium">Example:</h5>
        <p className="mt-1">
          For a {country} account (requiring {payoutDelay} days), if a client:
        </p>
        <ul className="ml-4 mt-1 list-disc">
          <li>Books and pays 10 days before the session → Get paid 1 day after session</li>
          <li>
            Books and pays 3 days before the session → Get paid {Math.max(1, payoutDelay - 3)} days
            after session
          </li>
          <li>
            Books and pays the same day as the session → Get paid {payoutDelay} days after session
          </li>
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Note: You&apos;ll receive notifications about upcoming payouts in your Notifications
        center. After establishing a history with Stripe, you may be eligible for faster payouts.
      </p>
    </>
  );
}

function NoConnectAccountFlow({
  dbUser,
  t,
}: {
  dbUser: BillingPageClientProps['dbUser'];
  t: ReturnType<typeof useTranslations<'account.billing'>>;
}) {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [selectedCountry, setSelectedCountry] = useState<string>('PT');
  const [isCreating, setIsCreating] = useState(false);

  // Sync country when profile loads
  React.useEffect(() => {
    if (
      profile?.country &&
      STRIPE_CONNECT_SUPPORTED_COUNTRIES.includes(profile.country as (typeof STRIPE_CONNECT_SUPPORTED_COUNTRIES)[number])
    ) {
      setSelectedCountry(profile.country);
    }
  }, [profile?.country]);

  if (!dbUser.stripeIdentityVerified) {
    return (
      <div className="space-y-4">
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle>Identity verification required</AlertTitle>
          <AlertDescription>
            You need to verify your identity before setting up payments. This is required by Stripe
            for compliance.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href={'/account/identity' as any}>Verify Identity</Link>
        </Button>
      </div>
    );
  }

  const handleCreateAccount = async () => {
    try {
      setIsCreating(true);
      const response = await fetch('/api/stripe/connect/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: selectedCountry }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.error?.includes('already exists')) {
          toast.info('Account already exists');
          router.refresh();
          return;
        }
        if (response.status === 409 && data.error?.includes('identity verification')) {
          toast.error('Identity verification required');
          router.push('/account/identity' as any);
          return;
        }
        throw new Error(data.error || data.details || 'Failed to create account');
      }

      if (data.success && data.accountId) {
        toast.success('Payment account created. Complete the setup below.');
        router.refresh();
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      console.error('Failed to create Connect account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create account. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select your country and create your payment account to start receiving payments.
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium">Country</label>
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select your country" />
          </SelectTrigger>
          <SelectContent>
            {STRIPE_CONNECT_SUPPORTED_COUNTRIES.map((code) => (
              <SelectItem key={code} value={code}>
                {getCountryLabel(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">Payment Terms</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          {t('legalDisclaimer')}{' '}
          <Link
            href="/legal/payment-policies"
            className="font-medium underline hover:text-blue-900 dark:hover:text-blue-100"
          >
            {t('paymentPolicies')}
          </Link>
          . {t('learnMore')}
        </AlertDescription>
      </Alert>
      <Button onClick={handleCreateAccount} disabled={isCreating} className="w-full">
        {isCreating ? t('buttons.connecting') : t('buttons.connect')}
      </Button>
    </div>
  );
}

function ConnectAccountContent({
  accountStatus,
  t,
}: {
  accountStatus: BillingPageClientProps['accountStatus'];
  t: ReturnType<typeof useTranslations<'account.billing'>>;
}) {
  const router = useRouter();
  const isFullyOnboarded =
    accountStatus?.detailsSubmitted && accountStatus?.chargesEnabled && accountStatus?.payoutsEnabled;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  return (
    <div className="space-y-6">
      <ConnectNotificationBanner
        collectionOptions={{
          fields: 'eventually_due',
          futureRequirements: 'include',
        }}
        onLoaderStart={() => {}}
        onLoadError={({ error }) => {
          console.error('Notification banner error:', error);
          toast.error('Failed to load notifications');
        }}
      />

      {!isFullyOnboarded ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountStatus.setup')}</CardTitle>
            <CardDescription>Complete the form below to finish setting up your payment account.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectAccountOnboarding
              onExit={() => router.refresh()}
              collectionOptions={{
                fields: 'eventually_due',
                futureRequirements: 'include',
              }}
              recipientTermsOfServiceUrl={`${baseUrl}/legal/payment-policies`}
              fullTermsOfServiceUrl={`${baseUrl}/legal/terms`}
              privacyPolicyUrl={`${baseUrl}/legal/privacy`}
              skipTermsOfServiceCollection={false}
              onStepChange={(stepChange) => {
                if (stepChange.step === 'complete' || stepChange.step === 'success') {
                  router.refresh();
                }
              }}
              onLoaderStart={() => {}}
              onLoadError={({ error }) => {
                console.error('Onboarding load error:', error);
                toast.error('Failed to load onboarding form');
              }}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              After completing the form, refresh the page to see your full account details.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Manage your business information and preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectAccountManagement
                collectionOptions={{
                  fields: 'currently_due',
                  futureRequirements: 'include',
                }}
                onLoaderStart={() => {}}
                onLoadError={({ error }) => {
                  console.error('Account management load error:', error);
                  toast.error('Failed to load account settings');
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
              <CardDescription>View your balance, payout schedule, and bank accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectPayouts
                onLoaderStart={() => {}}
                onLoadError={({ error }) => {
                  console.error('Payouts load error:', error);
                  toast.error('Failed to load payouts');
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Documents</CardTitle>
              <CardDescription>Upload and manage verification documents.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectDocuments
                onLoaderStart={() => {}}
                onLoadError={({ error }) => {
                  console.error('Documents load error:', error);
                  toast.error('Failed to load documents');
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function BillingPageContent({ dbUser, accountStatus }: BillingPageClientProps) {
  const t = useTranslations('account.billing');
  const { profile, error: profileError } = useUserProfile();
  const userCountry = profile?.country || null;

  React.useEffect(() => {
    if (profileError) {
      toast.error('Failed to load country information', {
        description: 'Payment timing details may be inaccurate. Please refresh to try again.',
      });
    }
  }, [profileError]);

  const hasConnectAccount = !!dbUser.stripeConnectAccountId;

  return (
    <div className="container pb-16">
      <h1 className="mb-6 text-3xl font-bold">Billing</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('subtitle')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasConnectAccount ? (
              <StripeConnectProvider>
                <ConnectAccountContent accountStatus={accountStatus} t={t} />
              </StripeConnectProvider>
            ) : (
              <NoConnectAccountFlow dbUser={dbUser} t={t} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>Learn about payment processing and payout schedules.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm">
                <h4 className="mb-2 font-medium">Payment Breakdown</h4>
                <ul className="list-inside list-disc space-y-1">
                  <li>Your earnings: 85% of the booking amount</li>
                  <li>Platform fee: 15% of the booking amount</li>
                </ul>
              </div>
              <div className="text-sm">
                <PaymentAgingInformation userCountry={userCountry} profileError={profileError} />
              </div>
              <div className="text-sm">
                <h4 className="mb-2 font-medium">Requirements</h4>
                <ul className="list-inside list-disc space-y-1">
                  <li>Valid bank account in your country</li>
                  <li>Government-issued ID or passport</li>
                  <li>Proof of address (may be required)</li>
                  <li>Additional documentation based on your location</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BillingPageClient(props: BillingPageClientProps) {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load billing information">
      <Suspense
        fallback={<div className="container mx-auto py-10">Loading billing information...</div>}
      >
        <BillingPageContent {...props} />
      </Suspense>
    </ComponentErrorBoundary>
  );
}
