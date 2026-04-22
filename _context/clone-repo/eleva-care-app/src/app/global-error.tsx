'use client';

/**
 * Global Error Boundary
 *
 * This component catches unhandled errors at the root layout level.
 * It must include <html> and <body> tags since it replaces the root layout when active.
 * Errors are automatically captured and sent to Sentry.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#app-router
 */
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture the error and send it to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-foreground mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              We&apos;ve been notified and are working to fix the issue.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mb-6">Error ID: {error.digest}</p>
            )}
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
