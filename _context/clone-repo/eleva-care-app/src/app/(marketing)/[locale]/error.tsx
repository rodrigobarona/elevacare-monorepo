'use client';

/**
 * Marketing Route Error Boundary
 *
 * Catches errors in the marketing routes and sends them to Sentry (Better Stack).
 */
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Error');

  useEffect(() => {
    // Capture the error and send it to Sentry (Better Stack)
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center">
      <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-lg text-muted-foreground">{t('description')}</p>
      {error.digest && (
        <p className="mb-4 text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md bg-destructive px-6 py-2 text-destructive-foreground hover:bg-destructive/90"
      >
        {t('retry')}
      </button>
    </div>
  );
}
