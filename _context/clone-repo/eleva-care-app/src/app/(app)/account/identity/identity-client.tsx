'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { AlertTriangle, BadgeCheck, Clock, Fingerprint, Info, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type ApiStatus = 'not_started' | 'requires_input' | 'processing' | 'verified' | 'canceled' | 'failed';
type DisplayStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

function mapApiStatusToDisplay(status: ApiStatus): DisplayStatus {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'processing':
      return 'pending';
    case 'canceled':
    case 'failed':
      return 'rejected';
    default:
      return 'unverified';
  }
}

interface IdentityPageClientProps {
  dbUser: {
    id: string;
    stripeIdentityVerificationId: string | null;
  };
  verificationStatus: {
    status: DisplayStatus;
    lastUpdated: string | null;
    details?: string;
  } | null;
}

function IdentityPageContent({ verificationStatus: initialStatus }: IdentityPageClientProps) {
  const t = useTranslations('account.identity');
  const router = useRouter();
  const [status, setStatus] = useState<DisplayStatus>(initialStatus?.status ?? 'unverified');
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialStatus?.lastUpdated ?? null);
  const [isStartingVerification, setIsStartingVerification] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/identity/verification/status');
      const data = await response.json();
      const displayStatus = mapApiStatusToDisplay((data.status as ApiStatus) ?? 'not_started');
      setStatus(displayStatus);
      setLastUpdated(data.lastUpdated ?? null);
      return displayStatus;
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return status;
    }
  }, [status]);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus.status);
      setLastUpdated(initialStatus.lastUpdated ?? null);
    }
  }, [initialStatus?.status, initialStatus?.lastUpdated]);

  const handleStartVerification = async () => {
    try {
      setIsStartingVerification(true);
      const response = await fetch('/api/stripe/identity/verification', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? 'Failed to start identity verification. Please try again.');
        return;
      }

      if (data.success && data.status === 'verified') {
        setStatus('verified');
        toast.success('Already verified', {
          description: 'Your identity has already been verified.',
        });
        return;
      }

      if (!data.clientSecret) {
        toast.error(data.error ?? 'Failed to start verification process');
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        toast.error('Stripe could not be loaded. Please refresh the page.');
        return;
      }

      const { error } = await stripe.verifyIdentity(data.clientSecret);

      if (error) {
        toast.error('Verification failed', { description: error.message ?? 'Please try again.' });
      } else {
        toast.success('Verification submitted!', { description: 'Checking status...' });
        await refreshStatus();
        router.refresh();
      }
    } catch {
      toast.error('Failed to start identity verification. Please try again.');
    } finally {
      setIsStartingVerification(false);
    }
  };

  const renderStatusBadge = () => {
    switch (status) {
      case 'verified':
        return (
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-200">
            <BadgeCheck className="h-4 w-4" />
            <span>{t('status.verified')}</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <Clock className="h-4 w-4" />
            <span>{t('status.pending')}</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('status.rejected')}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Fingerprint className="h-4 w-4" />
            <span>{t('status.unverified')}</span>
          </div>
        );
    }
  };

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('subtitle')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
            {renderStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">
              Privacy & Data Protection
            </AlertTitle>
            <AlertDescription className="space-y-2 text-blue-800 dark:text-blue-200">
              <p>
                {t('privacyNotice')}{' '}
                <Link href="/legal/privacy" className="font-medium underline hover:text-blue-900">
                  {t('privacyPolicy')}
                </Link>{' '}
                and{' '}
                <Link href="/trust/dpa" className="font-medium underline hover:text-blue-900">
                  {t('dataProcessing')}
                </Link>
                .
              </p>
              <p className="text-sm">{t('securityInfo')}</p>
            </AlertDescription>
          </Alert>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How We Use Your Identity Data</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{t('dataUsage')}</p>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                <li>{t('dataUsageItems.fraud')}</li>
                <li>{t('dataUsageItems.compliance')}</li>
                <li>{t('dataUsageItems.trust')}</li>
                <li>{t('dataUsageItems.payments')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {status === 'unverified' || status === 'rejected' ? (
            <div>
              <p className="mb-4">
                Please complete identity verification to ensure security and compliance. This is a
                quick process that requires a government-issued photo ID and a selfie.
              </p>
              <p className="mb-4 text-sm text-muted-foreground">
                We use a specialized verification flow that ensures a smooth and secure verification
                process.
              </p>
              <Button onClick={handleStartVerification} disabled={isStartingVerification}>
                {isStartingVerification ? t('buttons.starting') : t('buttons.start')}
              </Button>
            </div>
          ) : status === 'pending' ? (
            <div>
              <p className="mb-4">
                Your identity verification is currently under review. This process typically takes
                1-2 business days. You&apos;ll be notified once the review is complete.
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={async () => {
                    await refreshStatus();
                    router.refresh();
                    toast.success('Status updated');
                  }}
                  variant="outline"
                >
                  {t('buttons.checkStatus')}
                </Button>
                <Button onClick={handleStartVerification} disabled={isStartingVerification}>
                  {isStartingVerification ? t('buttons.starting') : t('buttons.resume')}
                </Button>
              </div>
              {lastUpdated && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          ) : status === 'verified' ? (
            <div>
              <p className="mb-4 text-green-700 dark:text-green-300">
                Your identity has been successfully verified. Thank you for completing this
                important security step.
              </p>
              <Button asChild>
                <Link href={'/account/billing' as any}>Continue to Payment Setup</Link>
              </Button>
              {lastUpdated && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Verified on: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function IdentityPageClient(props: IdentityPageClientProps) {
  return (
    <Suspense
      fallback={
        <div className="container flex min-h-[400px] items-center justify-center">
          <p className="text-muted-foreground">Loading identity verification...</p>
        </div>
      }
    >
      <IdentityPageContent {...props} />
    </Suspense>
  );
}
