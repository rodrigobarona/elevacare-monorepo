'use client';

/**
 * Expert Setup Checklist - WorkOS Version
 *
 * TODO: This is a temporary stub. The full implementation is being migrated from Clerk to WorkOS.
 * See components/_archive/features/expert-setup/ExpertSetupChecklist.tsx for the original version.
 */
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type SetupStep = {
  id: string;
  name: string;
  description: string;
  href: string;
  completed: boolean;
};

export function ExpertSetupChecklist() {
  const { user, loading: isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 'profile',
      name: 'Fill out your expert profile',
      description: 'Complete your profile with your expertise, bio, and profile picture',
      href: '/booking/expert',
      completed: false,
    },
    {
      id: 'availability',
      name: 'Set your availability',
      description: "Define when you're available for consultations",
      href: '/booking/schedule',
      completed: false,
    },
    {
      id: 'events',
      name: 'Create a service',
      description: 'Create at least one service to offer to clients',
      href: '/booking/events',
      completed: false,
    },
    {
      id: 'google_account',
      name: 'Connect Google account',
      description: 'Connect your Google account for calendar integration',
      href: '/account/security',
      completed: false,
    },
    {
      id: 'identity',
      name: 'Verify your identity',
      description: 'Complete identity verification for your account',
      href: '/account/identity',
      completed: false,
    },
    {
      id: 'payment',
      name: 'Connect payment account',
      description: 'Set up Stripe Connect to receive payments',
      href: '/account/billing',
      completed: false,
    },
  ]);

  useEffect(() => {
    async function loadStatus() {
      if (!user || isLoading) return;

      try {
        setLoading(true);
        const result = await checkExpertSetupStatus();

        if (result.setupStatus) {
          setSetupSteps((prev) =>
            prev.map((step) => ({
              ...step,
              completed: result.setupStatus?.[step.id as keyof typeof result.setupStatus] || false,
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load setup status:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, [user, isLoading]);

  const completedSteps = setupSteps.filter((step) => step.completed).length;
  const totalSteps = setupSteps.length;
  const progress = Math.round((completedSteps / totalSteps) * 100);

  // If all steps are completed, don't show anything
  if (completedSteps === totalSteps && !loading) {
    return null;
  }

  if (loading || isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-muted"></div>
          <div className="h-2 w-full rounded bg-muted"></div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Complete Your Expert Setup</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {completedSteps} of {totalSteps} steps completed
        </p>
      </div>

      <Progress value={progress} className="mb-6" />

      <div className="space-y-3">
        {setupSteps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 transition-colors',
              'hover:bg-muted/50',
              step.completed && 'bg-muted/30',
            )}
          >
            <div className="mt-0.5">
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className={cn(
                  'font-medium',
                  step.completed && 'text-muted-foreground line-through',
                )}
              >
                {step.name}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {completedSteps > 0 && completedSteps < totalSteps && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            You&apos;re making great progress! Complete the remaining steps to start accepting
            bookings.
          </p>
        </div>
      )}
    </div>
  );
}
