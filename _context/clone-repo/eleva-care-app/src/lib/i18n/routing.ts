export const locales = ['en', 'es', 'pt', 'pt-BR'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale = 'en' as const;

export const routing = {
  locales,
  defaultLocale,
  // Use 'as-needed' to only show locale prefix for non-default locales
  // - English: /about, /help/patient (no prefix)
  // - Portuguese: /pt/about, /pt/help/patient
  localePrefix: 'as-needed',
  pathnames: {
    // ----------------
    // Static routes first (higher priority)
    // ----------------
    '/': '/',
    '/about': '/about',
    '/evidence-based-care': '/evidence-based-care',
    '/dashboard': '/dashboard',
    '/login': '/login',
    '/register': '/register',
    '/onboarding': '/onboarding',
    '/unauthorized': '/unauthorized',
    '/legal': '/legal',
    '/legal/privacy': '/legal/privacy',
    '/legal/terms': '/legal/terms',
    '/legal/cookie': '/legal/cookie',
    '/legal/payment-policies': '/legal/payment-policies',
    '/legal/expert-agreement': '/legal/expert-agreement',
    '/trust': '/trust',
    '/trust/security': '/trust/security',
    '/trust/dpa': '/trust/dpa',
    // Help Center routes - handled by [locale]/help route with URL-based locale
    '/help': '/help',
    '/help/patient': '/help/patient',
    '/help/expert': '/help/expert',
    '/help/workspace': '/help/workspace',
    '/contact': '/contact',
    '/community': '/community',
    '/services/pregnancy': '/services/pregnancy',
    '/services/postpartum': '/services/postpartum',
    '/services/menopause': '/services/menopause',
    '/become-expert': '/become-expert',
    '/for-organizations': '/for-organizations',

    // ----------------
    // Dynamic routes last (lower priority)
    // ----------------
    '/[username]': '/[username]',
    '/[username]/[eventSlug]': '/[username]/[eventSlug]',
    '/[username]/[eventSlug]/success': '/[username]/[eventSlug]/success',
    '/[username]/[eventSlug]/payment-processing': '/[username]/[eventSlug]/payment-processing',
  },
} as const;

/**
 * Get the consistent path for any locale
 * This version always returns the same path regardless of locale
 * @param path - The path
 * @returns The original path
 */
export function getLocalizedPath(path: string): string {
  return path;
}

/**
 * Check if a path is a static route rather than a dynamic route
 * @param path - The path to check
 * @returns boolean indicating if the path is a static route
 */
export function isStaticRoute(path: string): boolean {
  return !path.includes('[') && !path.includes(']');
}
