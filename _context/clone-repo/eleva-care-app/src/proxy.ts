import { ADMIN_ROUTES, EXPERT_ROUTES, SPECIAL_AUTH_ROUTES } from '@/lib/constants/roles';
import {
  getSeoRedirect,
  isPrivateSegment,
  isStaticFile,
  shouldSkipAuthForApi,
} from '@/lib/constants/routes';
import { locales, routing } from '@/lib/i18n';
import type { WorkOSPermission, WorkOSRole } from '@/types/workos-rbac';
import { ADMIN_ROLES, EXPERT_ROLES, WORKOS_PERMISSIONS, WORKOS_ROLES } from '@/types/workos-rbac';
import { authkit } from '@workos-inc/authkit-nextjs';
import { isMarkdownPreferred } from 'fumadocs-core/negotiation';
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware with WorkOS AuthKit + JWT-based RBAC
 *
 * Integrates:
 * - WorkOS AuthKit authentication
 * - JWT-based role and permission checking (zero database queries)
 * - Internationalization (i18n via next-intl)
 * - Expert setup flow management
 * - AI/LLM content negotiation (Accept header)
 *
 * This middleware uses JWT claims for RBAC instead of database queries,
 * resulting in faster authorization checks.
 *
 * @see /docs/02-core-systems/role-based-authorization.md
 * @see _docs/_WorkOS RABAC implemenation/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md
 */

// Enable debug logging with DEBUG_MIDDLEWARE=true
const DEBUG = process.env.DEBUG_MIDDLEWARE === 'true';

/**
 * Create internationalization middleware using the routing configuration
 */
const handleI18nRouting = createMiddleware(routing);

/**
 * AI/LLM Content Negotiation
 *
 * Rewrite help center paths to .mdx format when AI agents request markdown.
 * Uses the Accept header to detect AI agents preferring markdown content.
 *
 * Pattern handles locale-prefixed paths: /en/help/*, /pt/help/*, etc.
 * Generated dynamically from the canonical locales array to prevent drift.
 */
const LOCALE_ALTERNATION = locales.map((l) => l.replace('-', '\\-')).join('|');
const HELP_LOCALE_PATTERN = new RegExp(`^\\/(${LOCALE_ALTERNATION})\\/help(\\/.*)?$`);

/**
 * Protected routes with required permissions
 *
 * Define routes that require specific permissions from JWT.
 * This is checked AFTER authentication is confirmed.
 */
const PERMISSION_PROTECTED_ROUTES: Record<string, WorkOSPermission[]> = {
  // Analytics requires analytics:view permission (Top Expert only)
  '/dashboard/analytics': [WORKOS_PERMISSIONS.ANALYTICS_VIEW],
  '/api/analytics': [WORKOS_PERMISSIONS.ANALYTICS_VIEW],

  // Expert approval requires experts:approve permission (Admin only)
  '/admin/experts/approve': [WORKOS_PERMISSIONS.EXPERTS_APPROVE],
  '/api/admin/experts/approve': [WORKOS_PERMISSIONS.EXPERTS_APPROVE],

  // Platform settings require settings:edit_platform permission
  '/admin/settings': [WORKOS_PERMISSIONS.SETTINGS_EDIT_PLATFORM],

  // User management requires users:view_all permission
  '/admin/users': [WORKOS_PERMISSIONS.USERS_VIEW_ALL],

  // Partner routes require partner permissions
  '/partner': [WORKOS_PERMISSIONS.PARTNER_VIEW_DASHBOARD],
  '/partner/settings': [WORKOS_PERMISSIONS.PARTNER_MANAGE_SETTINGS],
  '/partner/team': [WORKOS_PERMISSIONS.TEAM_VIEW_MEMBERS],
};

/**
 * Apply AuthKit headers to a response
 *
 * This helper consolidates the header forwarding pattern used throughout the proxy.
 * - Set-Cookie headers are appended (supports multiple cookies)
 * - Other headers are set (overwrite if exists)
 *
 * @param response - The NextResponse to add headers to
 * @param authkitHeaders - Headers from authkit() call
 */
function applyAuthkitHeaders(response: NextResponse, authkitHeaders: Headers): void {
  for (const [key, value] of authkitHeaders) {
    if (key.toLowerCase() === 'set-cookie') {
      response.headers.append(key, value);
    } else {
      response.headers.set(key, value);
    }
  }
}

/**
 * Create request headers with AuthKit headers merged in
 *
 * Used when we need to forward AuthKit headers to downstream handlers.
 * Excludes Set-Cookie headers which should only be on the response.
 *
 * @param originalHeaders - The original request headers
 * @param authkitHeaders - Headers from authkit() call
 * @returns New Headers object with merged headers
 */
function createRequestHeadersWithAuth(originalHeaders: Headers, authkitHeaders: Headers): Headers {
  const headers = new Headers(originalHeaders);
  for (const [key, value] of authkitHeaders) {
    if (key.toLowerCase() !== 'set-cookie') {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * Path matching utilities
 */
function isPathMatch(path: string, pattern: string): boolean {
  if (pattern === path) return true;

  // Handle wildcard patterns (e.g., /admin*)
  if (pattern.endsWith('*')) {
    const basePath = pattern.slice(0, -1);
    return path.startsWith(basePath);
  }

  // Handle regex patterns (e.g., /login(.*) or /admin(.*))
  if (pattern.includes('(.*)')) {
    const basePath = pattern.replace('(.*)', '');
    return path === basePath || path.startsWith(basePath + '/') || path.startsWith(basePath);
  }

  // Handle dynamic username patterns
  if (pattern === '/:username') {
    const segments = path.split('/').filter(Boolean);
    return segments.length === 1;
  }
  if (pattern === '/:username/(.*)') {
    const segments = path.split('/').filter(Boolean);
    return segments.length >= 2;
  }

  return false;
}

function matchPatternsArray(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => isPathMatch(path, pattern));
}

/**
 * Check if request is for a private route (requires authentication)
 */
function isPrivateRoute(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  const segments = path.split('/').filter(Boolean);

  // Skip locale prefix if present
  const startIndex = locales.includes(segments[0] as (typeof locales)[number]) ? 1 : 0;
  const firstSegment = segments[startIndex];

  return firstSegment ? isPrivateSegment(firstSegment) || path.startsWith('/api/') : false;
}

/**
 * Extract role and permissions from JWT claims
 *
 * WorkOS AuthKit includes role and permissions in the JWT when RBAC is enabled.
 */
function extractRBACFromSession(user: any): {
  role: WorkOSRole;
  permissions: WorkOSPermission[];
} {
  // Extract role from JWT claims (defaults to 'patient')
  const role = (user?.role as WorkOSRole) || WORKOS_ROLES.PATIENT;

  // Extract permissions from JWT claims (defaults to empty array)
  const permissions = (user?.permissions as WorkOSPermission[]) || [];

  return { role, permissions };
}

/**
 * Check if user has required role
 */
function hasRequiredRole(userRole: WorkOSRole, requiredRoles: readonly string[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if user has any of the required permissions
 */
function hasRequiredPermission(
  userPermissions: WorkOSPermission[],
  requiredPermissions: WorkOSPermission[],
): boolean {
  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}

/**
 * Check permission-protected routes
 */
function checkPermissionProtectedRoute(
  path: string,
  permissions: WorkOSPermission[],
): { allowed: boolean; requiredPermissions?: WorkOSPermission[] } {
  for (const [routePattern, requiredPerms] of Object.entries(PERMISSION_PROTECTED_ROUTES)) {
    if (path.startsWith(routePattern)) {
      const allowed = hasRequiredPermission(permissions, requiredPerms);
      return { allowed, requiredPermissions: requiredPerms };
    }
  }
  return { allowed: true };
}

/**
 * Main proxy function using AuthKit for authentication with JWT-based RBAC
 *
 * Pattern:
 * 1. Handle special routes (static, cron, SEO) that don't need auth
 * 2. Run AuthKit to establish auth context and get JWT claims
 * 3. Extract role and permissions from JWT (zero database queries)
 * 4. Run i18n middleware for marketing routes
 * 5. Apply authorization checks using JWT claims
 */
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (DEBUG) {
    console.log('\n========================================');
    console.log(`🔍 [MIDDLEWARE] ${request.method} ${path}`);
    console.log('========================================');
  }

  // ==========================================
  // STEP 1: HANDLE SPECIAL ROUTES (no auth/i18n needed)
  // ==========================================

  // Handle AI/LLM content negotiation FIRST (before auth checks)
  // If an AI agent requests markdown (via Accept header), rewrite to .mdx route
  if (isMarkdownPreferred(request)) {
    // Matches locale-prefixed paths: /pt/help/*, /es/help/*, etc.
    const localeHelpMatch = path.match(HELP_LOCALE_PATTERN);
    if (localeHelpMatch) {
      const locale = localeHelpMatch[1];
      const helpPath = localeHelpMatch[2] || '';
      const mdxPath = `/llms.mdx/${locale}/help${helpPath}`;
      if (DEBUG) console.log(`🤖 AI content negotiation: ${path} → ${mdxPath}`);
      return NextResponse.rewrite(new URL(mdxPath, request.url));
    }
    // Matches non-prefixed paths: /help/* (defaults to English)
    const defaultHelpMatch = path.match(/^\/help(\/.*)?$/);
    if (defaultHelpMatch) {
      const helpPath = defaultHelpMatch[1] || '';
      const mdxPath = `/llms.mdx/en/help${helpPath}`;
      if (DEBUG) console.log(`🤖 AI content negotiation (default EN): ${path} → ${mdxPath}`);
      return NextResponse.rewrite(new URL(mdxPath, request.url));
    }
  }

  // Skip for actual static files (images, fonts, CSS, JS) - these don't render React components
  if (isStaticFile(path)) {
    return NextResponse.next();
  }

  // Skip for internal APIs that don't need auth context
  if (shouldSkipAuthForApi(path)) {
    return NextResponse.next();
  }

  // Handle cron jobs - delegate to route handlers for proper signature validation
  // The proxy only performs basic checks; full QStash signature verification
  // happens in the route handlers via verifySignatureAppRouter()
  if (matchPatternsArray(path, SPECIAL_AUTH_ROUTES)) {
    if (path.startsWith('/api/cron/')) {
      // Check for presence of authentication headers (actual verification happens in route handlers)
      // These are defense-in-depth checks - spoofed headers will fail route-level validation
      const hasSignatureHeader =
        request.headers.has('upstash-signature') ||
        request.headers.has('Upstash-Signature') ||
        request.headers.has('x-upstash-signature');
      // Only consider API key valid if env var is defined and non-empty
      const hasApiKey =
        !!process.env.CRON_API_KEY &&
        request.headers.has('x-api-key') &&
        request.headers.get('x-api-key') === process.env.CRON_API_KEY;
      // Only consider cron secret valid if env var is defined and non-empty
      const hasCronSecret =
        !!process.env.CRON_SECRET &&
        request.headers.has('x-cron-secret') &&
        request.headers.get('x-cron-secret') === process.env.CRON_SECRET;

      // Only allow if there's a potential authentication method present
      // The route handler will verify signatures properly
      if (hasSignatureHeader || hasApiKey || hasCronSecret) {
        if (DEBUG) console.log(`⏰ Cron request (auth will be verified in handler): ${path}`);
        return NextResponse.next();
      }

      console.warn('❌ Unauthorized cron request - no valid auth headers:', path);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Handle SEO redirects
  const seoRedirectPath = getSeoRedirect(path);
  if (seoRedirectPath) {
    return NextResponse.redirect(new URL(seoRedirectPath, request.url), 301);
  }

  // WorkOS OAuth callback - public route
  if (path.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ==========================================
  // STEP 2: RUN AUTHKIT (establish auth context + get JWT claims)
  // ==========================================
  const {
    session,
    headers: authkitHeaders,
    authorizationUrl,
  } = await authkit(request, {
    debug: DEBUG,
  });

  // Extract role and permissions from JWT (zero database queries!)
  const { role: userRole, permissions: userPermissions } = session.user
    ? extractRBACFromSession(session.user)
    : { role: WORKOS_ROLES.PATIENT, permissions: [] as WorkOSPermission[] };

  if (DEBUG) {
    console.log(`👤 Auth: ${session.user?.email || 'anonymous'}`);
    console.log(`🎭 Role: ${userRole}`);
    console.log(`🔑 Permissions: ${userPermissions.length} total`);
  }

  // ==========================================
  // STEP 3: CHECK IF AUTH/APP ROUTE (no i18n needed)
  // ==========================================
  const pathSegments = path.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];

  // Note: 'help' is NOT in this list - it's now inside [locale]/help and handled by i18n middleware
  const isAuthOrAppRoute =
    firstSegment === 'login' ||
    firstSegment === 'register' ||
    firstSegment === 'onboarding' ||
    firstSegment === 'unauthorized' ||
    firstSegment === 'dashboard' ||
    firstSegment === 'setup' ||
    firstSegment === 'account' ||
    firstSegment === 'appointments' ||
    firstSegment === 'booking' ||
    firstSegment === 'admin' ||
    firstSegment === 'partner';

  // If auth/app route, skip i18n and use JWT-based RBAC (STEP 3 continued)
  if (isAuthOrAppRoute) {
    if (DEBUG) {
      console.log(`🔒 Auth/App route (no locale): ${path}`);
    }

    // Create request headers with AuthKit headers for downstream page handlers
    // This is critical: withAuth() reads these headers to verify middleware ran
    const requestHeaders = createRequestHeadersWithAuth(request.headers, authkitHeaders);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Also set response headers (for Set-Cookie and other response-specific headers)
    applyAuthkitHeaders(response, authkitHeaders);

    // Check if route requires authentication
    const isProtectedRoute =
      isPrivateRoute(request) ||
      matchPatternsArray(path, ADMIN_ROUTES) ||
      matchPatternsArray(path, EXPERT_ROUTES);

    if (isProtectedRoute && !session.user) {
      if (DEBUG) console.log(`🔒 Redirecting to sign-in: ${path}`);
      const redirectResponse = NextResponse.redirect(authorizationUrl!);
      applyAuthkitHeaders(redirectResponse, authkitHeaders);
      return redirectResponse;
    }

    // JWT-based authorization checks (no database queries!)
    if (session.user && isProtectedRoute) {
      // Check admin routes using JWT role
      if (matchPatternsArray(path, ADMIN_ROUTES)) {
        const isAdmin = hasRequiredRole(userRole, ADMIN_ROLES);
        if (!isAdmin) {
          console.warn(`🚫 Access denied: ${path} requires admin role (user has ${userRole})`);
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }

      // Check expert routes using JWT role
      if (matchPatternsArray(path, EXPERT_ROUTES)) {
        const isExpert = hasRequiredRole(userRole, EXPERT_ROLES);
        if (!isExpert) {
          console.warn(`🚫 Access denied: ${path} requires expert role (user has ${userRole})`);
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }

      // Check permission-protected routes using JWT permissions
      const permissionCheck = checkPermissionProtectedRoute(path, userPermissions);
      if (!permissionCheck.allowed) {
        console.warn(
          `🚫 Access denied: ${path} requires permissions: ${permissionCheck.requiredPermissions?.join(', ')}`,
        );
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    if (DEBUG) {
      console.log(`✅ Auth/App complete: ${path}`);
    }

    return response;
  }

  // ==========================================
  // STEP 4: RUN I18N MIDDLEWARE (for marketing routes only)
  // ==========================================
  // Pass original request to i18n middleware to preserve all Next.js properties
  // (nextUrl, geo, ip, etc.) Marketing pages don't use withAuth() so we don't
  // need to forward auth headers on the request - only on the response for cookies.
  const i18nResponse = handleI18nRouting(request);

  const rewrittenPath = i18nResponse.headers.get('x-middleware-rewrite');
  const finalPath = rewrittenPath ? new URL(rewrittenPath).pathname : path;

  if (DEBUG) {
    console.log(`🌐 i18n (marketing): ${path} → ${finalPath}`);
  }

  // ==========================================
  // STEP 5: PRESERVE AUTH HEADERS ON I18N RESPONSE
  // ==========================================
  applyAuthkitHeaders(i18nResponse, authkitHeaders);

  // ==========================================
  // STEP 6: APPLY AUTHORIZATION CHECKS (for marketing routes)
  // ==========================================
  const pathWithoutLocale = locales.some((locale) => finalPath.startsWith(`/${locale}/`))
    ? finalPath.substring(finalPath.indexOf('/', 1))
    : finalPath;

  const isProtectedRoute =
    isPrivateRoute(request) ||
    matchPatternsArray(pathWithoutLocale, ADMIN_ROUTES) ||
    matchPatternsArray(pathWithoutLocale, EXPERT_ROUTES);

  if (isProtectedRoute && !session.user) {
    if (DEBUG) console.log(`🔒 Redirecting to sign-in: ${path}`);
    const redirectResponse = NextResponse.redirect(authorizationUrl!);
    applyAuthkitHeaders(redirectResponse, authkitHeaders);
    return redirectResponse;
  }

  // JWT-based authorization checks for protected marketing routes
  if (session.user && isProtectedRoute) {
    // Check admin routes
    if (matchPatternsArray(pathWithoutLocale, ADMIN_ROUTES)) {
      const isAdmin = hasRequiredRole(userRole, ADMIN_ROLES);
      if (!isAdmin) {
        console.warn(`🚫 Access denied: ${path} requires admin role`);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // Check expert routes
    if (matchPatternsArray(pathWithoutLocale, EXPERT_ROUTES)) {
      const isExpert = hasRequiredRole(userRole, EXPERT_ROLES);
      if (!isExpert) {
        console.warn(`🚫 Access denied: ${path} requires expert role`);
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }

    // Check permission-protected routes
    const permissionCheck = checkPermissionProtectedRoute(pathWithoutLocale, userPermissions);
    if (!permissionCheck.allowed) {
      console.warn(
        `🚫 Access denied: ${path} requires permissions: ${permissionCheck.requiredPermissions?.join(', ')}`,
      );
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  if (DEBUG) {
    console.log(`✅ Complete: ${path} → ${finalPath}`);
  }

  return i18nResponse;
}

/**
 * Configure which paths the proxy middleware runs on
 *
 * **Matcher Strategy:**
 * The proxy runs on ALL routes EXCEPT:
 * - Next.js internals (_next, _vercel)
 * - Static assets (images, fonts, CSS, JS bundles)
 *
 * **Allowed File Extensions (routes, not static files):**
 * - `.txt` (LLM documentation: /llms-full.txt)
 * - `.mdx` (Fumadocs MDX routes: /docs/*.mdx)
 * - No extension (regular routes)
 *
 * **Static File Handling:**
 * Static files are excluded in the matcher regex AND in isStaticFile() helper.
 * This dual protection ensures static assets bypass middleware entirely.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/middleware#matcher
 */
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next (Next.js internals, static files, image optimization)
     * - _vercel (Vercel internals)
     * - Static files: .png, .jpg, .jpeg, .gif, .webp, .avif, .svg, .ico,
     *                 .woff, .woff2, .ttf, .eot, .css, .js, .map
     *
     * NOTE: .txt and .mdx are intentionally NOT excluded - they are routes
     */
    '/((?!_next|_vercel|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|css|js|map)$).*)',
    // Root path (ensure home page goes through proxy)
    '/',
    // LLM full documentation (explicit for clarity - would match regex anyway)
    '/llms-full.txt',
  ],
};
