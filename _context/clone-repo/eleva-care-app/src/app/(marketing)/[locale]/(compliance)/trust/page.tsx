import { isValidLocale } from '@/app/i18n';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Trust Index Page
 *
 * Redirects to the default trust document (Security) based on locale.
 * Uses isValidLocale to validate the locale parameter before redirecting.
 *
 * @param params - Page parameters containing the locale (PageProps)
 * @returns Never returns - always redirects
 *
 * @example
 * ```tsx
 * // /trust redirects to /trust/security (English)
 * // /pt/trust redirects to /pt/trust/security (Portuguese)
 * TrustPage({ params: Promise.resolve({ locale: 'en' }) });
 * ```
 */
export default async function TrustPage({ params }: PageProps): Promise<never> {
  const { locale } = await params;

  // Handle invalid locale - redirect to default locale
  if (!isValidLocale(locale)) {
    redirect('/trust/security'); // Default locale (en) has no prefix
  }

  // Redirect to the default trust document (security)
  redirect(`/${locale}/trust/security`);
}
