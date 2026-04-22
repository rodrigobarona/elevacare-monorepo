'use client';

import { ProfilePublishToggle } from '@/components/features/profile/ProfilePublishToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SetupCompletePublishCardProps {
  isPublished: boolean;
  onPublishStatusChange?: (isPublished: boolean) => void;
}

export function SetupCompletePublishCard({
  isPublished: initialIsPublished,
  onPublishStatusChange,
}: SetupCompletePublishCardProps) {
  useAuth();
  // TODO: Get username from database once username field is added
  const username = ''; // Placeholder until username is implemented
  const [isPublished, setIsPublished] = useState(initialIsPublished);

  // Sync with parent prop changes
  useEffect(() => {
    setIsPublished(initialIsPublished);
  }, [initialIsPublished]);

  // Poll for publication status changes
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await checkExpertSetupStatus();
        if (result.isSetupComplete !== undefined) {
          const newStatus = Boolean(result.isSetupComplete);
          if (newStatus !== isPublished) {
            setIsPublished(newStatus);
            onPublishStatusChange?.(newStatus);
          }
        }
      } catch (error) {
        console.error('Failed to poll publication status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isPublished, onPublishStatusChange]);

  return (
    <div className="mb-10 rounded-xl border-2 border-green-100 bg-green-50 p-8 text-center shadow-xs">
      <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
      <h2 className="mb-2 text-2xl font-bold text-green-800">Setup Complete!</h2>
      <p className="mb-6 text-green-700">
        Congratulations! You&apos;ve completed all the required steps to set up your expert profile.
      </p>

      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6">
          <h3 className="mb-3 text-lg font-medium">Ready to start accepting clients?</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {isPublished
              ? 'Your profile is published! Clients can now find and book your services.'
              : 'Your profile is ready to be published. Once published, clients can find and book your services.'}
          </p>

          <div className="mt-6">
            <div className="flex flex-col items-center gap-3">
              <ProfilePublishToggle initialPublishedStatus={isPublished} />

              {isPublished && username && (
                <Button asChild variant="outline" className="mt-2 w-full">
                  <Link href={`/${username}`} target="_blank">
                    Preview Your Public Profile
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
