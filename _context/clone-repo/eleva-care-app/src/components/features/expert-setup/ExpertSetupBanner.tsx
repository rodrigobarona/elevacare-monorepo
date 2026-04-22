'use client';

import { Button } from '@/components/ui/button';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function ExpertSetupBanner() {
  const { user, loading: authLoading } = useAuth();
  const isLoaded = !authLoading;
  const [isComplete, setIsComplete] = useState(true);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!isLoaded || !user) return;

      try {
        setLoading(true);
        const result = await checkExpertSetupStatus();

        if (result.setupStatus) {
          // Count completed steps
          const requiredSteps = [
            'profile',
            'availability',
            'events',
            'google_account',
            'identity',
            'payment',
            'bank_account',
          ];

          const completedCount = requiredSteps.filter(
            (step) => !!result.setupStatus?.[step as keyof typeof result.setupStatus],
          ).length;

          const percentage = Math.round((completedCount / requiredSteps.length) * 100);
          setCompletionPercentage(percentage);
          setIsComplete(percentage === 100);
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSetupStatus();
  }, [isLoaded, user]);

  // Don't render anything if the setup is complete or still loading
  if (isComplete || loading || !isLoaded) {
    return null;
  }

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
      <div>
        <h3 className="font-medium">Complete your expert setup</h3>
        <p className="text-sm text-muted-foreground">
          {completionPercentage}% complete - finish setting up your profile
        </p>
      </div>
      <Button size="sm" asChild>
        <Link href="/setup">
          Continue Setup <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
