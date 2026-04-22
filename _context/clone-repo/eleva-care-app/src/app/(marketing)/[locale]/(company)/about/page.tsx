import { isValidLocale } from '@/app/i18n';
import AdvisorsSection from '@/components/sections/about/AdvisorsSection';
import BeliefsSection from '@/components/sections/about/BeliefsSection';
import JoinNetworkSection from '@/components/sections/about/JoinNetworkSection';
import MissionSection from '@/components/sections/about/MissionSection';
import TeamSection from '@/components/sections/about/TeamSection';
import HeadlineSection from '@/components/shared/text/HeadlineSection';
import TextBlock from '@/components/shared/text/TextBlock';
import type { MDXContentComponent } from '@/types/mdx';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { locales } from '@/lib/i18n/routing';
import { generateGenericPageMetadata } from '@/lib/seo/metadata-utils';
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

// Static content - cache for 24 hours
// TODO: Migrate to 'use cache' + cacheLife('days') when next/root-params ships
// and next-intl enables cacheComponents: https://github.com/amannn/next-intl/issues/1493
export const revalidate = 86400;

// Define the page props
interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generates metadata for the About page based on locale.
 *
 * Uses a safe locale fallback to 'en' if the provided locale is invalid.
 * Dynamically imports MDX metadata for the locale, falling back to default
 * values if the import fails.
 *
 * @param params - Page parameters containing the locale
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * // Called automatically by Next.js during rendering
 * const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
 * // Returns: { title: 'About Eleva Care', description: '...', openGraph: {...} }
 *
 * // With invalid locale, falls back to 'en'
 * const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'invalid' }) });
 * // Uses 'en' locale for metadata generation
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  // Use default locale for metadata if invalid (page component handles redirect)
  const safeLocale = isValidLocale(locale) ? locale : 'en';

  try {
    // Dynamically import metadata from MDX file using Next.js 16 native approach
    const { metadata } = await import(`@/content/about/${safeLocale}.mdx`);

    return generateGenericPageMetadata(
      safeLocale,
      '/about',
      metadata.title,
      metadata.description,
      'secondary', // Use secondary variant for about page
      ['about eleva care', 'mission', 'vision', 'healthcare team', 'women health'],
    );
  } catch (error) {
    console.error('Error loading metadata from MDX:', error);

    return generateGenericPageMetadata(
      safeLocale,
      '/about',
      'About Eleva Care',
      'Learn about our mission, vision, and team at Eleva Care.',
      'secondary',
      ['about eleva care', 'mission', 'vision', 'healthcare team', 'women health'],
    );
  }
}

/**
 * Generates static parameters for all supported locales.
 * Enables static pre-rendering of the About page for each locale at build time.
 *
 * @returns Array of locale parameters for static generation
 */
export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

/**
 * About Page Component
 *
 * Renders the About page with localized MDX content.
 * Redirects to default locale if the provided locale is invalid.
 *
 * @param params - Page parameters containing the locale
 * @returns JSX element rendering the About page content
 *
 * @example
 * ```tsx
 * // Rendered by Next.js App Router
 * <AboutPage params={Promise.resolve({ locale: 'en' })} />
 * ```
 */
export default async function AboutPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    redirect('/about'); // Default locale (en) has no prefix
  }

  // Native Next.js 16 MDX import - Turbopack optimized
  // Dynamic import with proper error handling
  let AboutContent: MDXContentComponent;
  try {
    const mdxModule = await import(`@/content/about/${locale}.mdx`);
    AboutContent = mdxModule.default as MDXContentComponent;
  } catch (error) {
    console.error(`Failed to load MDX content for locale ${locale}:`, error);
    return notFound();
  }

  return (
    <main className="overflow-hidden">
      <div className="px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-7xl">
          <AboutContent
            components={{
              Button,
              Separator,
              Image,
              TextBlock,
              HeadlineSection,
              AdvisorsSection,
              BeliefsSection,
              JoinNetworkSection,
              MissionSection,
              TeamSection,
            }}
          />
        </div>
      </div>
    </main>
  );
}
