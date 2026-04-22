/**
 * Next.js Instrumentation File
 *
 * This file is automatically loaded by Next.js to initialize observability tools.
 * It runs once when a new Next.js server instance is bootstrapped.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
import * as Sentry from '@sentry/nextjs';

/**
 * Register function called by Next.js to initialize instrumentation.
 * Conditionally loads the appropriate Sentry configuration based on runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry configuration (Node.js runtime)
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry configuration (middleware, edge functions)
    await import('../sentry.edge.config');
  }
}

/**
 * Captures unhandled errors from Next.js request handlers.
 * This is the recommended way to capture request errors in Next.js 16+.
 */
export const onRequestError = Sentry.captureRequestError;
