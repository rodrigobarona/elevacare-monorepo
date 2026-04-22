/**
 * Sentry Server Configuration
 *
 * This file configures the Sentry SDK for the server-side (Node.js).
 * It enables error monitoring, tracing, and logging for server-side operations.
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
  // External services (Stripe, WorkOS, etc.) are excluded to avoid CORS issues
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/eleva\.care\/api/,
    /^https:\/\/.*\.vercel\.app\/api/,
  ],

  // Filter out common noise errors that don't need tracking
  ignoreErrors: [
    // Network errors that are typically transient
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    // Next.js internal errors
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  integrations: [
    // Console logging integration: Sends console logs to Sentry
    Sentry.consoleLoggingIntegration({
      levels: ['error', 'warn'],
    }),
  ],
});
