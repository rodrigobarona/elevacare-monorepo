'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { SetupStatus } from '@/types/expert-setup';
import { Check, Circle } from 'lucide-react';

interface ExpertSetupProgressProps {
  setupStatus: SetupStatus;
  isProfilePublished: boolean;
}

const steps: { key: keyof SetupStatus; label: string; href: string }[] = [
  { key: 'profile', label: 'Profile', href: '/setup/profile' },
  { key: 'availability', label: 'Availability', href: '/setup/availability' },
  { key: 'events', label: 'Events', href: '/setup/events' },
  { key: 'identity', label: 'Identity', href: '/account/identity' },
  { key: 'payment', label: 'Payments', href: '/account/billing' },
  { key: 'google_account', label: 'Google Calendar', href: '/setup/google-calendar' },
];

export function ExpertSetupProgress({ setupStatus, isProfilePublished }: ExpertSetupProgressProps) {
  const completedCount = steps.filter((s) => setupStatus[s.key]).length;
  const totalSteps = steps.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  const allComplete = completedCount === totalSteps;

  const firstIncompleteStep = steps.find((s) => !setupStatus[s.key]);
  const continueHref = firstIncompleteStep?.href || '/setup';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Setup Progress</CardTitle>
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{totalSteps} Complete
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPercent} className="h-2" />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {steps.map((step) => {
            const isComplete = setupStatus[step.key];
            return (
              <Link
                key={step.key}
                href={step.href as any}
                className={cn(
                  'flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted',
                  isComplete && 'text-primary',
                  !isComplete && 'text-muted-foreground',
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" />
                )}
                {step.label}
              </Link>
            );
          })}
        </div>

        {allComplete && !isProfilePublished && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="mb-2 text-sm font-medium">
              Setup complete! Publish your profile to start accepting clients.
            </p>
            <Button asChild size="sm">
              <Link href={'/booking/expert' as any}>Publish Profile</Link>
            </Button>
          </div>
        )}

        {!allComplete && (
          <Button asChild className="w-full">
            <Link href={continueHref as any}>Continue Setup</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
