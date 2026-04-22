import { isValidLocale } from '@/app/i18n';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

// Force static generation for this redirect page
export const dynamic = 'force-static';

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generates metadata for the Legal index page.
 *
 * @param params - Page parameters containing the locale
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * const metadata = await generateMetadata({
 *   params: Promise.resolve({ locale: 'en' })
 * });
 * // Returns: { title: 'Eleva.care - Legal', ... }
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  // Defensive fallback for metadata generation in edge cases.
  // The page component redirects before render, but this ensures
  // metadata is valid if called independently.
  if (!isValidLocale(locale)) {
    return {
      title: 'Eleva.care - Legal',
      description: 'Legal information and documents for Eleva.care',
    };
  }

  return {
    title: 'Eleva.care - Legal',
    description: 'Legal information and documents for the Eleva.care digital health platform',
    openGraph: {
      title: 'Eleva.care - Legal',
      description: 'Legal information and documents for the Eleva.care digital health platform',
      siteName: 'Eleva.care',
    },
  };
}

/**
 * Legal Index Page
 *
 * Redirects to the default legal document (Terms of Service).
 * Handles locale-aware redirects for both default and non-default locales.
 *
 * @param params - Page parameters containing the locale
 *
 * @example
 * ```tsx
 * // /legal redirects to /legal/terms (English)
 * // /pt/legal redirects to /pt/legal/terms (Portuguese)
 * ```
 */
export default async function LegalPage({ params }: PageProps): Promise<never> {
  const { locale } = await params;

  // Handle invalid locale - redirect to default locale
  if (!isValidLocale(locale)) {
    redirect('/legal/terms'); // Default locale (en) has no prefix
  }

  // Redirect to the default legal document (terms)
  redirect(`/${locale}/legal/terms`);
}
