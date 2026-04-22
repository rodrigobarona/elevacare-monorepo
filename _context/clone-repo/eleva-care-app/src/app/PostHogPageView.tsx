'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { Suspense, useEffect, useRef } from 'react';

// PostHog and Browser API Type Definitions
interface PostHogProperties {
  [key: string]: string | number | boolean | null | undefined;
}

interface NavigatorConnection {
  effectiveType?: string;
}

interface ExtendedNavigator extends Navigator {
  connection?: NavigatorConnection;
}

interface WindowWithPageStartTime extends Window {
  pageStartTime?: number;
}

/**
 * PostHog Page View Tracker
 *
 * Tracks pageviews with enhanced metadata for both:
 * - **Web Analytics**: Traffic, visitors, bounce rate, referrers
 * - **Product Analytics**: User journeys, funnels, retention
 *
 * PostHog is the PRIMARY analytics platform for unified insights.
 * Vercel Analytics serves as a BACKUP for quick dashboard access.
 *
 * NOTE: Web Vitals (LCP, CLS, FCP, INP) are NOT tracked here.
 * They are handled by:
 * - Vercel Speed Insights (authoritative for Vercel deployments)
 * - Sentry BrowserTracing (automatic Web Vitals capture)
 *
 * @see https://posthog.com/docs/web-analytics
 */
function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();
  const previousPath = useRef<string>('');

  // Enhanced pageview tracking
  useEffect(() => {
    if (!pathname || !posthog) return;

    let url = window.origin + pathname;
    if (searchParams.toString()) {
      url = `${url}?${searchParams.toString()}`;
    }

    // Extract referring domain for web analytics
    const getReferringDomain = (): string | undefined => {
      if (!document.referrer) return undefined;
      try {
        return new URL(document.referrer).hostname;
      } catch {
        return undefined;
      }
    };

    // Track page view with enhanced metadata for both web and product analytics
    const pageViewProperties: PostHogProperties = {
      // Standard PostHog web analytics properties
      $current_url: url,
      $referrer: document.referrer || undefined,
      $referring_domain: getReferringDomain(),

      // Enhanced tracking properties
      pathname: pathname,
      search_params: searchParams.toString(),
      referrer: document.referrer, // Keep for backward compatibility
      previous_path: previousPath.current,
      page_title: document.title,

      // Device and viewport
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: window.screen.width,
      screen_height: window.screen.height,

      // Browser info
      user_agent: navigator.userAgent,
      language: navigator.language,
      timezone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (error) {
          console.warn('Failed to get timezone, using UTC:', error);
          return 'UTC';
        }
      })(),
      connection_type: (navigator as ExtendedNavigator)?.connection?.effectiveType || 'unknown',

      // Route categorization for filtering/segmentation
      route_category: getRouteCategory(pathname),
      is_authenticated_route: isAuthenticatedRoute(pathname),
      locale: getLocaleFromPath(pathname),
    };

    posthog.capture('$pageview', pageViewProperties);

    // Track time spent on previous page
    if (previousPath.current && previousPath.current !== pathname) {
      const windowWithStartTime = window as WindowWithPageStartTime;
      posthog.capture('page_leave', {
        pathname: previousPath.current,
        time_on_page: windowWithStartTime.pageStartTime
          ? Date.now() - windowWithStartTime.pageStartTime
          : null,
      });
    }

    // Set start time for current page
    (window as WindowWithPageStartTime).pageStartTime = Date.now();
    previousPath.current = pathname;

    // NOTE: Web Vitals tracking removed - handled by Vercel Speed Insights and Sentry
    // See: Vercel Analytics <SpeedInsights /> component in layout.tsx
    // See: Sentry BrowserTracing in instrumentation-client.ts
  }, [pathname, searchParams, posthog]);

  return null;
}

// Helper functions
function getRouteCategory(pathname: string): string {
  if (pathname.includes('/(private)') || pathname.includes('/dashboard')) return 'app';
  if (pathname.includes('/admin')) return 'admin';
  if (pathname.includes('/auth')) return 'auth';
  if (pathname.includes('/api')) return 'api';
  if (pathname.startsWith('/[locale]')) return 'marketing';
  return 'other';
}

function isAuthenticatedRoute(pathname: string): boolean {
  return (
    pathname.includes('/(private)') ||
    pathname.includes('/dashboard') ||
    pathname.includes('/account') ||
    pathname.includes('/admin')
  );
}

function getLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/');
  const possibleLocale = segments[1];
  const supportedLocales = ['en', 'pt', 'es', 'pt-BR'];
  return supportedLocales.includes(possibleLocale) ? possibleLocale : 'en';
}

// NOTE: Web Vitals helper functions removed (getFirstPaint, getLargestContentfulPaint, getCumulativeLayoutShift)
// Web Vitals are now tracked by:
// - Vercel Speed Insights: Authoritative Web Vitals for Vercel deployments
// - Sentry BrowserTracing: Automatic Web Vitals capture with error correlation

// Wrap in Suspense to avoid useSearchParams deopt
export default function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
