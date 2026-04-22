'use client';

import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="mb-4 text-3xl font-bold">Something went wrong</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        We&apos;ve been notified and are working to fix the issue.
      </p>
      {error.digest && (
        <p className="mb-4 text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
