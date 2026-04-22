/**
 * Sentry Client-Side Instrumentation
 *
 * This file configures the Sentry SDK for the browser (client-side).
 * It enables error monitoring, session replay, user feedback, and logging.
 *
 * Performance optimizations:
 * - Replay integration uses lazy loading to reduce initial bundle
 * - Feedback integration auto-inject disabled (loaded on-demand via footer)
 * - Debug logging disabled in production
 *
 * Integration with PostHog:
 * - User context is linked in src/app/providers.tsx (PostHogUserTracker)
 * - When a user is identified in PostHog, the same user ID is set in Sentry
 * - PostHog session info is added to Sentry context for cross-platform debugging
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 * @see src/app/providers.tsx for PostHog-Sentry user linking
 */
import * as Sentry from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment tag for filtering in Sentry
  environment: process.env.NODE_ENV,

  // Adds request headers and IP for users
  // @see https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Sample rate for performance monitoring:
  // - Production: 10% of transactions (balance cost vs. observability)
  // - Development: 100% for debugging
  tracesSampleRate: isDev ? 1.0 : 0.1,

  // Enable in all environments for comprehensive error tracking
  enabled: true,

  // Debug logging only in development
  debug: isDev,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Distributed tracing: Propagate traces to your own API routes only
  // External services are excluded to avoid CORS issues and unnecessary trace context
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/eleva\.care\/api/,
    /^https:\/\/.*\.vercel\.app\/api/,
  ],

  // Filter out common browser errors that don't need tracking
  ignoreErrors: [
    // Browser extensions and third-party scripts
    /^Script error\.?$/,
    /^Javascript error: Script error\.? on line 0$/,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // User-initiated navigation
    'AbortError',
    'ResizeObserver loop',
    // Chrome extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],

  integrations: [
    // Session Replay: Records user sessions for debugging
    // Captures video-like reproductions of user interactions
    // Note: Uses lazy loading internally to reduce initial bundle impact
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),

    // User Feedback: Allows users to submit feedback on errors
    // Triggered manually via footer link (SentryFeedbackButton component)
    // Note: autoInject: false means this doesn't add to initial bundle
    Sentry.feedbackIntegration({
      autoInject: false,
      colorScheme: 'system',
      showBranding: true,
      buttonLabel: 'Report a Bug',
      formTitle: 'Report a Bug',
      successMessageText: 'Thank you for your feedback!',
      submitButtonLabel: 'Send Feedback',
      cancelButtonLabel: 'Cancel',
      emailLabel: 'Email',
      nameLabel: 'Name',
      messageLabel: 'What happened?',
      messagePlaceholder: 'Describe what happened...',
      showEmail: true,
      showName: true,
      isEmailRequired: false,
      isNameRequired: false,
    }),

    // Console logging integration: Sends console logs to Sentry
    Sentry.consoleLoggingIntegration({
      levels: ['error', 'warn'],
    }),
  ],

  // Session Replay sample rates:
  // - Production: 10% of sessions for general monitoring
  // - Development: 100% for debugging
  // - Always capture 100% of sessions with errors
  replaysSessionSampleRate: isDev ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
});

/**
 * Instruments router navigations for tracing.
 * This export is required for capturing route changes in Next.js App Router.
 *
 * Available from @sentry/nextjs version 9.12.0 onwards
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
