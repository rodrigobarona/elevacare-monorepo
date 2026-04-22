'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { loadStripe } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type VerificationStatus =
  | 'not_started'
  | 'requires_input'
  | 'processing'
  | 'verified'
  | 'canceled'
  | 'failed';

async function fetchVerificationStatus(): Promise<{
  verified: boolean;
  status?: VerificationStatus;
}> {
  const response = await fetch('/api/stripe/identity/verification/status');
  const data = await response.json();
  return {
    verified: data.verified === true,
    status: data.status as VerificationStatus | undefined,
  };
}

export default function IdentityPage() {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('not_started');
  const [loading, setLoading] = useState(true);
  const [isStartingVerification, setIsStartingVerification] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { verified, status } = await fetchVerificationStatus();
      if (verified) {
        setVerificationStatus('verified');
      } else if (status) {
        setVerificationStatus(status);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const startVerification = async () => {
    setIsStartingVerification(true);

    try {
      const response = await fetch('/api/stripe/identity/verification', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;

          if (response.status === 429 && errorData.details?.cooldownRemaining) {
            errorMessage = `Too many verification attempts. Please try again in ${errorData.details.cooldownRemaining} seconds.`;
          } else if (response.status === 403) {
            errorMessage =
              'You do not have permission to start verification. Please contact support.';
          } else if (response.status === 500) {
            errorMessage =
              'Server error. Please try again later or contact support if the issue persists.';
          } else if (response.status === 503) {
            errorMessage = 'Verification service unavailable. Please try again later.';
          }
        } catch {
          if (errorText) errorMessage += ` - ${errorText}`;
        }

        toast.error('Verification Error', { description: errorMessage });
        setIsStartingVerification(false);
        return;
      }

      const data = await response.json();

      if (data.success && data.status === 'verified') {
        setVerificationStatus('verified');
        toast.success('Already verified', {
          description: 'Your identity has already been verified.',
        });
        setIsStartingVerification(false);
        return;
      }

      if (!data.clientSecret) {
        toast.error('Error', {
          description: data.error || 'Failed to start verification process',
        });
        setIsStartingVerification(false);
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        toast.error('Error', { description: 'Stripe could not be loaded. Please refresh the page.' });
        setIsStartingVerification(false);
        return;
      }

      toast.info('Verification modal opening...');

      const { error } = await stripe.verifyIdentity(data.clientSecret);

      if (error) {
        toast.error('Verification failed', { description: error.message ?? 'Please try again.' });
      } else {
        toast.success('Verification submitted!', {
          description: 'Checking status...',
        });
        await refreshStatus();
      }
    } catch (error) {
      console.error('Error starting identity verification:', error);
      toast.error('Error', {
        description:
          error instanceof Error
            ? error.message
            : error instanceof TypeError && error.message.includes('fetch')
              ? 'Network error. Please check your internet connection and try again.'
              : 'An error occurred while starting the verification process',
      });
    } finally {
      setIsStartingVerification(false);
    }
  };

  // Handle redirectTo query param when already verified
  useEffect(() => {
    if (verificationStatus !== 'verified' || loading) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has('redirectTo')) return;

    const redirectTo = searchParams.get('redirectTo') || '';
    const validRedirects = ['billing', 'connect', 'setup'];

    if (validRedirects.includes(redirectTo)) {
      const redirectUrl =
        redirectTo === 'billing' || redirectTo === 'connect'
          ? '/account/billing'
          : redirectTo === 'setup'
            ? '/setup'
            : '/account/billing';

      toast.success('Identity already verified', {
        description: 'You are being redirected to continue your setup.',
      });
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    }
  }, [verificationStatus, loading]);

  return (
    <div className="container py-10">
      <h1 className="mb-6 text-3xl font-bold">Identity Verification</h1>

      <Card>
        <CardHeader>
          <CardTitle>Verify Your Identity</CardTitle>
          <CardDescription>
            We need to verify your identity to comply with financial regulations and protect our
            platform from fraud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="ml-3">Checking verification status...</span>
            </div>
          ) : (
            <>
              <p className="mb-4">
                The verification process takes just a few minutes. You&apos;ll need to provide:
              </p>
              <ul className="mb-4 list-disc pl-5">
                <li>
                  A valid government-issued photo ID (passport, driver&apos;s license, or ID card)
                </li>
                <li>A live photo of yourself for facial recognition</li>
              </ul>

              {verificationStatus === 'verified' ? (
                <div className="rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950/30 dark:text-green-200">
                  <p className="font-medium">Your identity has been successfully verified!</p>
                  <p className="mt-2">You can now proceed to set up your payment account.</p>
                </div>
              ) : (
                <div className="rounded-md bg-blue-50 p-4 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                  <p className="font-medium">
                    {verificationStatus === 'requires_input'
                      ? 'Your verification needs additional information.'
                      : 'Please complete the identity verification process to continue.'}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          {loading ? (
            <Button disabled>Loading...</Button>
          ) : verificationStatus === 'verified' ? (
            <Button onClick={() => router.push('/account/billing')}>
              Continue to Payment Setup
            </Button>
          ) : (
            <Button onClick={startVerification} disabled={isStartingVerification}>
              {isStartingVerification ? 'Starting Verification...' : 'Start Verification Process'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
