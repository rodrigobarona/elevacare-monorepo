'use client';

import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

interface ComponentErrorFallbackProps extends FallbackProps {
  message?: string;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return null;
}

export function ComponentErrorFallback({
  error,
  resetErrorBoundary,
  message = 'Something went wrong',
}: ComponentErrorFallbackProps) {
  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {errorMessage && (
        <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
      )}
      {resetErrorBoundary && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="mt-3"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function handleComponentError(error: unknown, info: ErrorInfo) {
  Sentry.captureException(error, {
    extra: { componentStack: info.componentStack },
  });
}

/**
 * Wraps a component tree in an ErrorBoundary with Sentry reporting
 * and the shared fallback UI. Use for isolating widget-level failures.
 */
export function ComponentErrorBoundary({
  children,
  fallbackMessage,
}: {
  children: ReactNode;
  fallbackMessage?: string;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={(props) => (
        <ComponentErrorFallback {...props} message={fallbackMessage} />
      )}
      onError={handleComponentError}
    >
      {children}
    </ErrorBoundary>
  );
}
