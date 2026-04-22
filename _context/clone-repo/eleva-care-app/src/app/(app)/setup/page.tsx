'use client';

import * as React from 'react';
import { SetupCompletePublishCard } from '@/components/features/expert-setup/SetupCompletePublishCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ReactConfetti from 'react-confetti';

// Generate unique IDs for skeleton items
const skeletonIds = [
  'profile-skeleton',
  'settings-skeleton',
  'business-skeleton',
  'identity-skeleton',
  'security-skeleton',
  'product-skeleton',
  'discount-skeleton',
  'bank-skeleton',
];

// Step type definition
type SetupStep = {
  id: string;
  name: string;
  description: string;
  href: string;
  completed: boolean;
  position: number;
};

export default function ExpertSetupPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isProfilePublished, setIsProfilePublished] = useState(false);

  // Button text mapping by step ID
  const buttonTextMap: Record<string, string> = {
    google_account: 'Configure',
    discount: 'Add Discount',
    payment: 'Setup Payments',
    // Default for other steps is 'Complete'
  };

  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'profile',
      name: 'Fill out your expert profile',
      description: 'Complete your profile with your expertise, bio, and profile picture',
      href: '/booking/expert',
      completed: false,
      position: 1,
    },
    {
      id: 'availability',
      name: 'Set your availability',
      description: "Define when you're available for consultations",
      href: '/booking/schedule',
      completed: false,
      position: 2,
    },
    {
      id: 'events',
      name: 'Create a service',
      description: 'Create at least one service to offer to clients',
      href: '/booking/events',
      completed: false,
      position: 3,
    },
    {
      id: 'google_account',
      name: 'Connect Google account',
      description: 'Connect your Google account for calendar integration',
      href: '/account/security',
      completed: false,
      position: 4,
    },
    {
      id: 'identity',
      name: 'Verify your identity',
      description: 'Complete identity verification for your account',
      href: '/account/identity',
      completed: false,
      position: 5,
    },
    {
      id: 'payment',
      name: 'Connect payment account',
      description: 'Set up Stripe Connect to receive payments',
      href: '/account/billing',
      completed: false,
      position: 6,
    },
  ]);

  // Load setup status on component mount
  useEffect(() => {
    const loadSetupStatus = async () => {
      try {
        const result = await checkExpertSetupStatus();

        // Update completed steps
        setSteps((prev) =>
          prev.map((step) => ({
            ...step,
            completed: !!result.setupStatus?.[step.id as keyof typeof result.setupStatus],
          })),
        );

        // Show confetti if all complete
        if (result.isSetupComplete && !showConfetti) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 8000);
        }
      } catch (error) {
        console.error('Failed to load setup status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSetupStatus();
  }, [showConfetti]);

  // Refresh status when the page gains focus (user comes back from another tab)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && !isLoading) {
        try {
          const result = await checkExpertSetupStatus();

          // Update completed steps
          setSteps((prev) =>
            prev.map((step) => ({
              ...step,
              completed: !!result.setupStatus?.[step.id as keyof typeof result.setupStatus],
            })),
          );
        } catch (error) {
          console.error('Failed to refresh setup status:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLoading]);

  // Check if all steps are completed
  const allStepsCompleted = steps.every((step) => step.completed);

  // Render button with appropriate link and handling for each step
  const renderStepButton = (step: SetupStep) => {
    if (step.completed) {
      return <CheckCircle2 className="h-8 w-8 text-green-500" />;
    }

    // Special handling for payment step - ensure identity is verified first
    if (step.id === 'payment') {
      const identityStep = steps.find((s) => s.id === 'identity');
      if (identityStep && !identityStep.completed) {
        return (
          <Button asChild>
            <Link href="/account/identity?redirectTo=billing">Complete Identity First</Link>
          </Button>
        );
      }
    }

    // Get button text from mapping, fallback to 'Complete' if not found
    const buttonText = buttonTextMap[step.id] || 'Complete';

    return (
      <Button asChild>
        <Link href={step.href}>{buttonText}</Link>
      </Button>
    );
  };

  if (isLoading) {
    return <SetupSkeleton />;
  }

  return (
    <div className="container py-10">
      {showConfetti && (
        <ReactConfetti
          recycle={false}
          numberOfPieces={500}
          wind={0.01}
          gravity={0.3}
          initialVelocityY={20}
          tweenDuration={100}
        />
      )}
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Welcome to Eleva Care!</h1>
          <p className="mt-2 text-muted-foreground">
            Complete these steps to set up your expert profile and start helping others
          </p>
        </div>

        {allStepsCompleted ? (
          <SetupCompletePublishCard
            isPublished={isProfilePublished}
            onPublishStatusChange={(newStatus) => setIsProfilePublished(newStatus)}
          />
        ) : null}

        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-6">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xl">
                {step.position}
                {step.completed && (
                  <div className="absolute -right-1 -top-1 rounded-full bg-white p-0.5">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium">{step.name}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>

                {renderStepButton(step)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <Skeleton className="mx-auto h-10 w-64" />
          <Skeleton className="mx-auto mt-2 h-5 w-80" />
        </div>

        <div className="space-y-6">
          {skeletonIds.map((id) => (
            <div key={id} className="flex items-start gap-6">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-1 items-center justify-between">
                <div className="w-3/4 space-y-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
