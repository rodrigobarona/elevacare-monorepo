import * as Sentry from '@sentry/nextjs';
import { DocsProvider } from '@/components/providers/help-provider';
import { DOCS_TYPE, DOCS_VERSION } from '@/lib/docs-config';
import { mapToFumadocsLocale } from '@/lib/fumadocs-i18n.config';
import type { ReactNode } from 'react';

// Import Fumadocs styles
import './help.css';

/**
 * Help Center Layout
 *
 * Simplified layout that inherits from marketing layout:
 * - Header, Footer, SmoothScrollProvider, IntlProvider all inherited
 * - Only provides DocsProvider for Fumadocs UI components
 * - Locale comes from URL params (not cookies)
 *
 * URL Structure:
 * - English (default): /help/patient (locale = 'en')
 * - Portuguese: /pt/help/patient (locale = 'pt')
 *
 * @see https://fumadocs.vercel.app/docs/ui/layouts
 *
 * @example
 * ```tsx
 * // Used by Next.js App Router for /help routes
 * // URL: /help/patient or /pt/help/patient
 * <HelpLayout params={Promise.resolve({ locale: 'en' })}>
 *   <PortalLayout>
 *     <DocsPage />
 *   </PortalLayout>
 * </HelpLayout>
 * ```
 */

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function HelpLayout({ children, params }: Props) {
  const { locale } = await params;
  const fumadocsLocale = mapToFumadocsLocale(locale);

  // Set Sentry context for documentation pages
  Sentry.setTag('section', 'documentation');
  Sentry.setTag('docs.locale', fumadocsLocale);
  Sentry.setContext('documentation', {
    type: DOCS_TYPE,
    version: DOCS_VERSION,
    locale: fumadocsLocale,
  });

  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Entered documentation section (locale: ${fumadocsLocale})`,
    level: 'info',
  });

  return (
    <DocsProvider locale={fumadocsLocale}>
      <main
        id="eleva-care-help"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pt-20 lg:px-6 lg:pt-24"
      >
        {children}
      </main>
    </DocsProvider>
  );
}
