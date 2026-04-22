/**
 * Route Constants - Centralized Route Definitions
 *
 * Following Next.js 16 best practices for proxy middleware.
 * All routes are defined here to ensure consistency across the application.
 *
 * Used by:
 * - proxy.ts: Authentication and routing logic
 * - [username]/page.tsx: Reserved route validation
 * - Components: Route-based conditional rendering
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/middleware
 */

// ============================================
// AUTHENTICATION ROUTES
// ============================================

/**
 * Routes that handle authentication flows
 * These are public routes but handled specially in proxy
 */
export const AUTH_ROUTES = [
  'login',
  'register',
  'sign-out',
  'auth',
  'unauthorized',
  'onboarding',
] as const;

// ============================================
// PRIVATE/PROTECTED ROUTES
// ============================================

/**
 * Routes that require authentication
 * Users will be redirected to sign-in if not authenticated
 */
export const PRIVATE_ROUTE_SEGMENTS = [
  'dashboard',
  'setup',
  'account',
  'appointments',
  'booking',
  'admin',
] as const;

/**
 * Expert-only route segments
 */
export const EXPERT_ROUTE_SEGMENTS = ['appointments', 'booking'] as const;

/**
 * Admin-only route segments
 */
export const ADMIN_ROUTE_SEGMENTS = ['admin'] as const;

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Public content routes (SEO-friendly pages)
 */
export const PUBLIC_CONTENT_ROUTES = [
  'about',
  'history',
  'legal',
  'trust',
  'services',
  'help',
  'contact',
  'community',
  'become-expert',
  'for-organizations',
  'docs', // Documentation routes (Fumadocs)
] as const;

/**
 * System routes (API, internals, etc.)
 */
export const SYSTEM_ROUTES = ['api', '.well-known', 'dev', '_next', '_vercel', '_botid'] as const;

// ============================================
// RESERVED ROUTES (Combined)
// ============================================

/**
 * All reserved routes that should NOT be treated as usernames
 *
 * This combines all route types to prevent username collision
 * in the dynamic [username] route.
 */
export const RESERVED_ROUTES = [
  ...AUTH_ROUTES,
  ...PRIVATE_ROUTE_SEGMENTS,
  ...PUBLIC_CONTENT_ROUTES,
  ...SYSTEM_ROUTES,
] as const;

// ============================================
// SEO REDIRECTS
// ============================================

/**
 * SEO redirects for legacy URLs
 * Maps old paths to new paths (e.g., /legal/security → /trust/security)
 */
export const SEO_REDIRECTS = {
  '/legal/security': '/trust/security',
  '/legal/dpa': '/trust/dpa',
  '/become-partner': '/for-organizations',
} as const;

/**
 * Check if path needs SEO redirect
 * Uses startsWith to avoid matching unintended substrings
 *
 * @returns New path if redirect needed, null otherwise
 *
 * @example
 * ```typescript
 * getSeoRedirect('/legal/security') // returns '/trust/security'
 * getSeoRedirect('/blog/legal/security-tips') // returns null (no false positive)
 * ```
 */
export function getSeoRedirect(path: string): string | null {
  for (const [oldPath, newPath] of Object.entries(SEO_REDIRECTS)) {
    // Use startsWith to only match exact path beginnings, not substrings
    if (path.startsWith(oldPath)) {
      return path.replace(oldPath, newPath);
    }
  }
  return null;
}

// ============================================
// ROUTE PATTERNS FOR PROXY EXCLUSION
// ============================================

/**
 * Static file patterns to skip in proxy
 *
 * IMPORTANT: We exclude paths under /docs/ and /llms from the generic extension check
 * because those are dynamic routes that should be handled by Next.js, not bypassed.
 *
 * Paths like /llms-full.txt and /docs/*.mdx are actual routes, not static files.
 */
export const STATIC_FILE_PATTERNS = [
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/site\.webmanifest$/,
  /^\/_next\//,
  /^\/\.well-known\//,
  // Match static assets: images, fonts, CSS, JS, etc. (but NOT .txt or .mdx which are routes)
  /\.(png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|css|js|map)$/i,
] as const;

/**
 * API route patterns to skip proxy-level authentication
 *
 * IMPORTANT: These routes bypass AuthKit middleware but must have their own security:
 *
 * - `/api/webhooks/` - Verified via webhook signatures (Stripe, WorkOS, etc.)
 * - `/api/cron/` - Verified via QStash signatures in route handlers
 * - `/api/qstash/` - Verified via QStash signatures in route handlers
 * - `/api/internal/` - Protected by INTERNAL_ADMIN_KEY in route handlers
 * - `/api/healthcheck` - Public health check (no sensitive data)
 * - `/api/health/` - Public service health (no sensitive data)
 * - `/api/create-payment-intent` - Protected by BotID + rate limiting + input validation
 * - `/api/og/` - Public OG image generation (required for social media crawlers)
 * - `/api/search` - Public documentation search
 * - `/monitoring` - Sentry tunnel route (internal monitoring)
 * - `/llms-full.txt` - Public LLM documentation
 * - `/llms.mdx/` - Public LLM MDX content negotiation
 */
export const SKIP_AUTH_API_PATTERNS = [
  '/api/webhooks/', // Signature-verified webhooks
  '/api/cron/', // QStash signature verification in handlers
  '/api/qstash/', // QStash signature verification in handlers
  '/api/internal/', // INTERNAL_ADMIN_KEY verification in handlers
  '/api/healthcheck', // Public health endpoint
  '/api/health/', // Public service health endpoints
  '/api/create-payment-intent', // BotID + rate limiting protection
  '/api/og/', // Public for social media crawlers
  '/api/search', // Public documentation search API
  '/monitoring', // Sentry tunnel route - must skip auth and i18n
  '/llms-full.txt', // LLM full documentation route (Fumadocs)
  '/llms.mdx/', // LLM MDX routes (Fumadocs content negotiation)
] as const;

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AuthRoute = (typeof AUTH_ROUTES)[number];
export type PrivateRouteSegment = (typeof PRIVATE_ROUTE_SEGMENTS)[number];
export type PublicContentRoute = (typeof PUBLIC_CONTENT_ROUTES)[number];
export type SystemRoute = (typeof SYSTEM_ROUTES)[number];
export type ReservedRoute = (typeof RESERVED_ROUTES)[number];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a route segment is reserved (cannot be used as username)
 */
export function isReservedRoute(segment: string): boolean {
  return RESERVED_ROUTES.includes(segment.toLowerCase() as ReservedRoute);
}

/**
 * Check if a path is an authentication route
 */
export function isAuthPath(segment: string): boolean {
  return AUTH_ROUTES.includes(segment.toLowerCase() as AuthRoute);
}

/**
 * Check if a path segment requires authentication
 */
export function isPrivateSegment(segment: string): boolean {
  return PRIVATE_ROUTE_SEGMENTS.includes(segment.toLowerCase() as PrivateRouteSegment);
}

/**
 * Check if a path segment requires expert role
 */
export function isExpertSegment(segment: string): boolean {
  return EXPERT_ROUTE_SEGMENTS.includes(
    segment.toLowerCase() as (typeof EXPERT_ROUTE_SEGMENTS)[number],
  );
}

/**
 * Check if a path segment requires admin role
 */
export function isAdminSegment(segment: string): boolean {
  return ADMIN_ROUTE_SEGMENTS.includes(
    segment.toLowerCase() as (typeof ADMIN_ROUTE_SEGMENTS)[number],
  );
}

/**
 * Check if path matches skip-auth API patterns
 */
export function shouldSkipAuthForApi(path: string): boolean {
  return SKIP_AUTH_API_PATTERNS.some((pattern) => path.startsWith(pattern));
}

/**
 * Check if path is a static file
 */
export function isStaticFile(path: string): boolean {
  return STATIC_FILE_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * Get all reserved routes as a readonly array
 */
export function getReservedRoutes(): readonly string[] {
  return RESERVED_ROUTES;
}

/**
 * Check if path starts with any public content route
 * Used for locale detection and i18n redirects
 *
 * @param path - The path to check (e.g., '/about', '/legal/terms')
 * @returns True if path starts with a public content route
 *
 * @example
 * ```typescript
 * isPublicContentPath('/about') // true
 * isPublicContentPath('/about/team') // true
 * isPublicContentPath('/legal/terms') // true
 * isPublicContentPath('/dashboard') // false
 * ```
 */
export function isPublicContentPath(path: string): boolean {
  return PUBLIC_CONTENT_ROUTES.some((route) => path.startsWith(`/${route}`));
}
