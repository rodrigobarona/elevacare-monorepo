/**
 * Sentry Edge Configuration
 *
 * This file configures the Sentry SDK for Edge Runtime (middleware, edge functions).
 * It enables error monitoring and tracing for edge operations.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment tag for filtering in Sentry
  environment: process.env.NODE_ENV,

  // Adds request headers and IP for users
  // @see https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Sample rate for performance monitoring:
  // - Production: 10% of transactions (balance cost vs. observability)
  // - Development: 100% for debugging
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable in all environments for comprehensive error tracking
  enabled: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Distributed tracing: Propagate traces to your own API routes
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/eleva\.care\/api/,
    /^https:\/\/.*\.vercel\.app\/api/,
  ],

  // Filter out common noise errors
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],
});
