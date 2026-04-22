'use client';

/**
 * Client Providers - WorkOS AuthKit Version
 *
 * Provides client-side functionality for:
 * - WorkOS authentication (via built-in useAuth hook)
 * - Theme management
 * - PostHog analytics (product analytics, feature flags)
 * - Sentry user context linking
 * - Novu notifications
 * - Cookie consent
 * - Authorization context
 */
import * as Sentry from '@sentry/nextjs';
import { AuthorizationProvider } from '@/components/shared/providers/AuthorizationProvider';
import { ENV_CONFIG } from '@/config/env';
import { NovuProvider } from '@novu/nextjs';
import { NovuProvider as ReactNovuProvider } from '@novu/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import dynamic from 'next/dynamic';
import { useParams, usePathname } from 'next/navigation';
import { posthog, PostHog, PostHogConfig } from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import { createCookieTranslations } from '../lib/i18n/cookie-translations';
import PostHogPageView from './PostHogPageView';

// Dynamically import CookieManager to prevent SSR issues
// This defers loading until the client-side, reducing initial bundle size
const CookieManager = dynamic(
  () => import('react-cookie-manager').then((mod) => mod.CookieManager),
  { ssr: false, loading: () => null },
);

// Enhanced configuration function
const getPostHogConfig = (): Partial<PostHogConfig> => {
  const isDev = ENV_CONFIG.NODE_ENV === 'development';
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return {
    api_host: ENV_CONFIG.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    ui_host: ENV_CONFIG.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    debug: isDev,
    capture_pageview: false, // We handle this manually for enhanced tracking
    capture_pageleave: true,
    capture_performance: true,
    // NOTE: Session recording disabled - using Sentry Replay instead
    // Sentry Replay links directly to errors for better debugging
    // and is included in the Sentry Developer plan (50 replays)
    disable_session_recording: true,
    autocapture: {
      capture_copied_text: true,
      css_selector_allowlist: ['[data-ph-capture]'],
      url_allowlist: isDev ? undefined : [window.location.hostname],
    },
    bootstrap: {
      distinctID: undefined,
      isIdentifiedID: false,
      featureFlags: {},
    },
    loaded: (ph: PostHog) => {
      if (isDev) {
        console.log('[PostHog] Loaded successfully');
      }

      ph.register({
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: ENV_CONFIG.NODE_ENV,
        build_timestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP,
      });
    },
    advanced_disable_decide: false,
    secure_cookie: !isLocalhost,
    persistence: 'localStorage+cookie' as const,
    cookie_expiration: 365,
    respect_dnt: true,
    opt_out_capturing_by_default: false,
    ip: !isDev,
    property_blacklist: ['$initial_referrer', '$initial_referring_domain'],
  };
};

/**
 * PostHog User Tracker with WorkOS Integration
 *
 * This component handles:
 * 1. User identification in PostHog (using WorkOS user ID)
 * 2. Sentry user context linking (same user ID for cross-platform debugging)
 * 3. Role-based group tracking (for segmenting analytics by user type)
 * 4. PostHog session info in Sentry context
 *
 * The WorkOS user ID is the single source of truth across:
 * - WorkOS Authentication
 * - PostHog Product Analytics
 * - Sentry Error Monitoring
 */
function PostHogUserTracker() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const params = useParams();
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch user role for group tracking
  // Using user?.id as dependency to only refetch when user changes
  useEffect(() => {
    // Skip if no user - role will be handled in the tracking effect
    if (!user?.id) return;

    let isMounted = true;

    // Fetch roles from API for group tracking
    fetch('/api/user/roles')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.roles?.length > 0) {
          // Use the highest privilege role for grouping
          const role =
            data.roles.includes('admin') || data.roles.includes('superadmin')
              ? 'admin'
              : data.roles.includes('expert_top')
                ? 'expert_top'
                : data.roles.includes('expert_community')
                  ? 'expert_community'
                  : 'user';
          setUserRole(role);
        } else {
          setUserRole('user');
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[PostHog] Failed to fetch user roles:', err);
          setUserRole('user'); // Default to user on error
        }
      });

    // Cleanup function to reset role when user changes/logs out
    return () => {
      isMounted = false;
      setUserRole(null);
    };
  }, [user?.id]);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const locale = (params?.locale as string) || 'en';
    const isPrivateRoute =
      pathname?.startsWith('/(private)') ||
      pathname?.includes('/dashboard') ||
      pathname?.includes('/account') ||
      pathname?.includes('/admin');

    posthog.register({
      route_type: isPrivateRoute ? 'private' : 'public',
      locale: locale,
      user_authenticated: !!user,
    });

    if (user) {
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userTimezone = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (error) {
          console.warn('Failed to get timezone, using UTC:', error);
          return 'UTC';
        }
      })();

      // Identify user in PostHog with WorkOS user ID
      posthog.identify(user.id, {
        email: user.email,
        name: userName,
        first_name: user.firstName,
        last_name: user.lastName,
        avatar: user.profilePictureUrl,
        email_verified: user.emailVerified,
        preferred_locale: locale,
        timezone: userTimezone,
      });

      posthog.people.set({
        email: user.email,
        name: userName,
        avatar: user.profilePictureUrl,
        locale: locale,
        last_seen: new Date().toISOString(),
      });

      // Set role-based group for analytics segmentation
      // This allows comparing behavior between user types (admins, experts, patients)
      if (userRole) {
        posthog.group('user_role', userRole, {
          role: userRole,
          is_expert: userRole.startsWith('expert'),
          is_admin: userRole === 'admin',
        });

        // Also add role to Sentry for filtering errors by user type
        Sentry.setTag('user_role', userRole);
      }

      // Set Sentry user context for error correlation
      // This links Sentry errors to the same user in PostHog
      Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
        username: userName || undefined,
      });

      // Add PostHog session info to Sentry for cross-platform debugging
      const sessionId = posthog.get_session_id?.();
      if (sessionId) {
        Sentry.setContext('posthog', {
          session_id: sessionId,
          distinct_id: posthog.get_distinct_id?.(),
          session_replay_url: posthog.get_session_replay_url?.({ withTimestamp: true }),
        });
      }

      // Add WorkOS context to Sentry
      Sentry.setContext('workos', {
        user_id: user.id,
        email_verified: user.emailVerified,
        has_profile_picture: !!user.profilePictureUrl,
      });
    } else {
      posthog.register({
        user_type: 'anonymous',
        locale: locale,
      });

      // Clear Sentry user context for anonymous users
      Sentry.setUser(null);
      Sentry.setTag('user_role', 'anonymous');
    }

    posthog.register({
      page_type: isPrivateRoute ? 'app' : 'marketing',
      page_section: isPrivateRoute
        ? pathname?.split('/')[2] || 'dashboard'
        : pathname?.split('/')[2] || 'home',
    });
  }, [user, loading, pathname, params, userRole]);

  return null;
}

// Novu wrapper component (WorkOS version with HMAC security)
function NovuWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [subscriberData, setSubscriberData] = useState<{
    subscriberId: string;
    subscriberHash: string;
    applicationIdentifier: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscriber hash from backend for HMAC auth
  useEffect(() => {
    if (loading || !user || !ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER) {
      return;
    }

    const fetchSubscriberHash = async () => {
      try {
        console.log('[Novu] Fetching subscriber hash for user:', user.id);
        const response = await fetch('/api/novu/subscriber-hash');

        if (!response.ok) {
          throw new Error(`Failed to fetch subscriber hash: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Novu] Subscriber hash fetched successfully');
        setSubscriberData(data);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Novu';
        console.error('[Novu] Initialization error:', errorMessage);
        setError(errorMessage);
      }
    };

    fetchSubscriberHash();
  }, [user, loading]);

  // Show children without Novu if user is not loaded or app ID is missing
  if (loading || !user || !ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER) {
    return <>{children}</>;
  }

  // Show children without Novu if there's an error (graceful degradation)
  if (error) {
    console.warn('[Novu] Running without notifications due to error:', error);
    return <>{children}</>;
  }

  // Wait for subscriber data to be loaded
  if (!subscriberData) {
    return <>{children}</>;
  }

  console.log('[Novu] Provider initialized for user:', subscriberData.subscriberId);

  return (
    <NovuProvider
      subscriberId={subscriberData.subscriberId}
      subscriberHash={subscriberData.subscriberHash}
      applicationIdentifier={subscriberData.applicationIdentifier}
    >
      <ReactNovuProvider
        applicationIdentifier={subscriberData.applicationIdentifier}
        subscriberId={subscriberData.subscriberId}
        subscriberHash={subscriberData.subscriberHash}
        apiUrl="https://eu.api.novu.co"
        socketUrl="https://eu.ws.novu.co"
      >
        {children}
      </ReactNovuProvider>
    </NovuProvider>
  );
}

interface ClientProvidersProps {
  children: React.ReactNode;
  messages: Record<string, unknown>;
}

/**
 * Client Providers - WorkOS Version
 *
 * Enhanced with comprehensive PostHog analytics.
 * Tracks user behavior across public and private sections.
 * Includes feature flags, session recording, and performance monitoring.
 *
 * Performance optimization: PostHog initialization is deferred until first user interaction
 * to reduce main thread blocking during initial page load.
 */
export function ClientProviders({ children, messages }: ClientProvidersProps) {
  const [posthogLoaded, setPosthogLoaded] = useState(false);
  const params = useParams();
  const posthogInitialized = useRef(false);
  const interactionHandlersAttached = useRef(false);

  // Get the current locale from the URL params
  const currentLocale = (params?.locale as string) || 'en';

  /**
   * Initialize PostHog - extracted for deferred execution
   * This function is called either after first interaction or after a delay
   */
  const initializePostHog = useCallback(() => {
    if (typeof window === 'undefined' || posthogInitialized.current) return;

    const apiKey = ENV_CONFIG.NEXT_PUBLIC_POSTHOG_KEY;

    if (!apiKey) {
      console.warn('[PostHog] Not initialized: Missing API key');
      return;
    }

    // Skip PostHog on localhost in development (optional)
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost && ENV_CONFIG.NODE_ENV === 'development') {
      console.info('[PostHog] Skipped initialization on localhost in development');
      return;
    }

    try {
      posthogInitialized.current = true;

      // Initialize PostHog with enhanced configuration
      const config = getPostHogConfig();

      posthog.init(apiKey, {
        ...config,
        loaded: (ph: PostHog) => {
          setPosthogLoaded(true);
          config.loaded?.(ph);

          // Track application start
          ph.capture('app_loaded', {
            locale: currentLocale,
            user_agent: navigator.userAgent,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            timezone: (() => {
              try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone;
              } catch (error) {
                console.warn('Failed to get timezone, using UTC:', error);
                return 'UTC';
              }
            })(),
            language: navigator.language,
            platform: navigator.platform,
          });
        },
      });

      // Track page visibility changes (useful for engagement analytics)
      document.addEventListener('visibilitychange', () => {
        posthog.capture('page_visibility_changed', {
          visibility_state: document.visibilityState,
        });
      });

      // Track network status (useful for understanding user connectivity)
      window.addEventListener('online', () => {
        posthog.capture('network_status_changed', { status: 'online' });
      });

      window.addEventListener('offline', () => {
        posthog.capture('network_status_changed', { status: 'offline' });
      });
    } catch (error) {
      console.error('[PostHog] Failed to initialize:', error);
    }
  }, [currentLocale]);

  useEffect(() => {
    // Performance optimization: Defer PostHog initialization
    // Initialize on first user interaction OR after 3 seconds, whichever comes first
    // This reduces main thread blocking during initial page load
    if (typeof window === 'undefined' || interactionHandlersAttached.current) return;
    interactionHandlersAttached.current = true;

    // Interaction events that indicate user engagement
    const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'];

    const handleFirstInteraction = () => {
      initializePostHog();
      // Clean up listeners after first interaction
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleFirstInteraction, { capture: true });
      });
    };

    // Add listeners for first interaction
    interactionEvents.forEach((event) => {
      window.addEventListener(event, handleFirstInteraction, { capture: true, passive: true });
    });

    // Fallback: Initialize after 3 seconds if no interaction
    // This ensures analytics still work for users who don't interact
    const fallbackTimeout = setTimeout(() => {
      initializePostHog();
      // Clean up interaction listeners
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleFirstInteraction, { capture: true });
      });
    }, 3000);

    return () => {
      clearTimeout(fallbackTimeout);
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, handleFirstInteraction, { capture: true });
      });
    };
  }, [initializePostHog]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthorizationProvider>
        <CookieManager
          cookieKitId={process.env.NEXT_PUBLIC_COOKIE_KIT_ID || ''}
          showManageButton={true}
          enableFloatingButton={false}
          displayType="popup"
          cookieKey={process.env.NEXT_PUBLIC_COOKIE_KEY || ''}
          theme="light"
          privacyPolicyUrl="/legal/cookie"
          translations={createCookieTranslations(messages)}
        >
          <PHProvider client={posthog}>
            {posthogLoaded && (
              <>
                <PostHogPageView />
                <PostHogUserTracker />
              </>
            )}
            <NovuWrapper>{children}</NovuWrapper>
          </PHProvider>
          <Toaster closeButton position="bottom-right" richColors />
        </CookieManager>
      </AuthorizationProvider>
    </ThemeProvider>
  );
}

/**
 * Internationalization Provider - For locale-specific routes
 * This wraps content with NextIntlClientProvider for translations
 * and also updates the HTML lang attribute to match the current locale
 */
export function IntlProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}) {
  // Update HTML lang attribute when the locale changes
  useEffect(() => {
    if (locale) {
      const htmlElement = document.documentElement;

      // Update HTML lang attribute if it has the dynamic lang data attribute
      if (htmlElement.getAttribute('data-dynamic-lang') === 'true') {
        htmlElement.lang = locale;
        console.log(`IntlProvider: Updated HTML lang attribute to ${locale}`);
      }

      // Set cookie to remember locale for future server-rendered pages
      document.cookie = `ELEVA_LOCALE=${locale};max-age=31536000;path=/`;
    }
  }, [locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(error) => {
        if (error.code === 'MISSING_MESSAGE') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Missing translation:', error.message);
          }
          return error.message;
        }
        throw error;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
