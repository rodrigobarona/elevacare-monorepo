import { isValidLocale } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import HeadlineSection from '@/components/shared/text/HeadlineSection';
import TextBlock from '@/components/shared/text/TextBlock';
import type { MDXContentComponent } from '@/types/mdx';
import {
  HeroSection,
  KeyNumbersSection,
  ClinicalAreasSection,
  SafetyQualitySection,
  FAQSection,
  ReferencesSection,
} from '@/components/sections/evidence-based-care';
import { locales } from '@/lib/i18n/routing';
import { generateGenericPageMetadata } from '@/lib/seo/metadata-utils';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

// Static content - cache for 24 hours
// TODO: Migrate to 'use cache' + cacheLife('days') when next/root-params ships
// and next-intl enables cacheComponents: https://github.com/amannn/next-intl/issues/1493
// Tag-based invalidation via unstable_cache is available now for dynamic data.
export const revalidate = 86400;

// Define the page props
interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generates metadata for the Evidence-Based Care page.
 *
 * Uses a safe locale fallback to 'en' if the provided locale is invalid
 * (via safeLocale). Dynamically imports MDX metadata from the content path
 * pattern `@/content/evidence-based-care/{locale}.mdx`.
 *
 * @param params - Page parameters containing the locale (PageProps)
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * // Called automatically by Next.js
 * const metadata = await generateMetadata({
 *   params: Promise.resolve({ locale: 'en' })
 * });
 * // Returns: { title: 'Evidence-Based Care...', description: '...', ... }
 * ```
 *
 * @example
 * ```tsx
 * // MDX import path pattern:
 * // '@/content/evidence-based-care/en.mdx'
 * // '@/content/evidence-based-care/pt.mdx'
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  // Use default locale for metadata if invalid (page component handles redirect)
  const safeLocale = isValidLocale(locale) ? locale : 'en';

  try {
    // Dynamically import metadata from MDX file using Next.js 16 native approach
    const { metadata } = await import(`@/content/evidence-based-care/${safeLocale}.mdx`);

    return generateGenericPageMetadata(
      safeLocale,
      '/evidence-based-care',
      metadata.title,
      metadata.description,
      'secondary', // Use secondary variant for evidence-based care page
      [
        'evidence-based care',
        'clinical excellence',
        'telehealth research',
        'women health science',
        'clinical trials',
        'peer-reviewed research',
      ],
    );
  } catch (error) {
    console.error('Error loading metadata from MDX:', error);

    return generateGenericPageMetadata(
      safeLocale,
      '/evidence-based-care',
      'Evidence-Based Care | Clinical Excellence | Eleva Care',
      'Discover how Eleva Care delivers evidence-based women\'s health care through telehealth. Backed by rigorous research and proven in clinical trials.',
      'secondary',
      [
        'evidence-based care',
        'clinical excellence',
        'telehealth research',
        'women health science',
      ],
    );
  }
}

/**
 * Generates static parameters for all supported locales.
 * Enables static pre-rendering at build time.
 *
 * @returns Array of locale parameters for static generation
 */
export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

/**
 * Evidence-Based Care Page Component
 *
 * Renders the evidence-based care page with localized MDX content.
 * Showcases clinical excellence and research backing.
 *
 * @param params - Page parameters containing the locale
 * @returns JSX element rendering the page content
 */
export default async function EvidenceBasedCarePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    redirect('/evidence-based-care'); // Default locale (en) has no prefix
  }

  // Native Next.js 16 MDX import - Turbopack optimized
  // Dynamic import with proper error handling
  let EvidenceBasedCareContent: MDXContentComponent;
  try {
    const mdxModule = await import(`@/content/evidence-based-care/${locale}.mdx`);
    EvidenceBasedCareContent = mdxModule.default as MDXContentComponent;
  } catch (error) {
    console.error(`Failed to load MDX content for locale ${locale}:`, error);
    return notFound();
  }

  return (
    <main className="overflow-hidden">
      <div className="px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-7xl">
          <EvidenceBasedCareContent
            components={{
              Button,
              Separator,
              HeadlineSection,
              TextBlock,
              HeroSection,
              KeyNumbersSection,
              ClinicalAreasSection,
              SafetyQualitySection,
              FAQSection,
              ReferencesSection,
            }}
          />
        </div>
      </div>
    </main>
  );
}

