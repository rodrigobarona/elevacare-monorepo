'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { Icons } from '@/components/icons/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MAX_ATTEMPTS = 15;
const CHECK_INTERVAL = 2000;

interface PaymentProcessingClientProps {
  params: Promise<{ username: string; eventSlug: string; locale: string }>;
  searchParams: Promise<{ startTime: string }>;
}

function PaymentProcessingClientInner({
  params,
  searchParams,
}: PaymentProcessingClientProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [resolvedParams, setResolvedParams] = useState<{
    username?: string;
    eventSlug?: string;
    locale?: string;
    startTime?: string;
  }>({});

  // Resolve promises when component mounts
  useEffect(() => {
    const resolveProps = async () => {
      try {
        const [paramsData, searchParamsData] = await Promise.all([params, searchParams]);
        setResolvedParams({
          ...paramsData,
          startTime: searchParamsData.startTime,
        });
      } catch (error) {
        console.error('Error resolving props:', error);
      }
    };

    resolveProps();
  }, [params, searchParams]);

  // Only start checking meeting status once we have all params resolved
  useEffect(() => {
    if (!resolvedParams.startTime || !resolvedParams.eventSlug) return;

    const checkMeetingStatus = async () => {
      try {
        const response = await fetch(
          `/api/meetings/status?startTime=${resolvedParams.startTime}&eventSlug=${resolvedParams.eventSlug}`,
        );
        const data = await response.json();

        if (data.status === 'created') {
          router.push(
            `/${resolvedParams.locale}/${resolvedParams.username}/${resolvedParams.eventSlug}/success?startTime=${resolvedParams.startTime}`,
          );
        } else if (attempts >= MAX_ATTEMPTS) {
          router.push(
            `/${resolvedParams.locale}/${resolvedParams.username}/${resolvedParams.eventSlug}?error=payment-timeout`,
          );
        } else {
          setAttempts((prev) => prev + 1);
        }
      } catch (error) {
        console.error('Error checking meeting status:', error);
      }
    };

    const timer = setTimeout(checkMeetingStatus, CHECK_INTERVAL);
    return () => clearTimeout(timer);
  }, [attempts, router, resolvedParams]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Processing Your Payment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-8">
        <Icons.spinner className="h-8 w-8 animate-spin" />
        <p className="mt-4 text-muted-foreground">Please wait while we confirm your payment...</p>
      </CardContent>
    </Card>
  );
}

export default function PaymentProcessingClient(props: PaymentProcessingClientProps) {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not process payment status">
      <PaymentProcessingClientInner {...props} />
    </ComponentErrorBoundary>
  );
}
