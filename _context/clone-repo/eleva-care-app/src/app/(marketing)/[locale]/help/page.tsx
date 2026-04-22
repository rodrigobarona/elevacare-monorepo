import { permanentRedirect } from 'next/navigation';

/**
 * Help Center Root Page
 *
 * Redirects to the default help portal (patient).
 * Uses absolute paths with conditional locale logic:
 * - Default locale (en) uses path without prefix: /help/patient
 * - Other locales include prefix: /{locale}/help/patient
 *
 * The locale is preserved via the conditional logic that checks
 * if locale is 'en' (default) or another supported locale.
 *
 * @example
 * ```
 * /help → /help/patient (English, no prefix)
 * /pt/help → /pt/help/patient (Portuguese, with prefix)
 * /es/help → /es/help/patient (Spanish, with prefix)
 * ```
 */
export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<never> {
  const { locale } = await params;

  // Redirect to patient portal - locale prefix handled by next-intl routing
  if (locale === 'en') {
    permanentRedirect('/help/patient');
  } else {
    permanentRedirect(`/${locale}/help/patient`);
  }
}

