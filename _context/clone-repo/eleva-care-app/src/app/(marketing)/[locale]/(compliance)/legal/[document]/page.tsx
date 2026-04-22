import { isValidLocale } from '@/app/i18n';
import { locales } from '@/lib/i18n/routing';
import { generatePageMetadata } from '@/lib/seo/metadata-utils';
import { mdxComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

// Static content - cache for 24 hours
// TODO: Migrate to 'use cache' + cacheLife('days') when next/root-params ships
// and next-intl enables cacheComponents: https://github.com/amannn/next-intl/issues/1493
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: string; document: string }>;
}

/** Valid legal document slugs */
const validDocuments = [
  'terms',
  'privacy',
  'cookie',
  'payment-policies',
  'expert-agreement',
] as const;

/** Union type of valid document slugs */
type DocumentKey = (typeof validDocuments)[number];

/** Mapping of document slugs to their display names */
const documentDisplayNames: Record<DocumentKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookie: 'Cookie Policy',
  'payment-policies': 'Payment Policies',
  'expert-agreement': 'Expert Agreement',
} as const;

/**
 * Generates metadata for legal document pages.
 *
 * Validates locale and document parameters, then dynamically imports
 * MDX metadata. Falls back to a display name if metadata import fails.
 *
 * @param params - Page parameters containing locale and document slug
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * // Called automatically by Next.js
 * const metadata = await generateMetadata({
 *   params: Promise.resolve({ locale: 'en', document: 'privacy' })
 * });
 * // Returns: { title: 'Privacy Policy', description: '...', ... }
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, document } = await params;

  if (!isValidLocale(locale) || !validDocuments.includes(document as DocumentKey)) {
    return generatePageMetadata({
      locale: 'en',
      path: `/legal/${document}`,
      title: 'Legal Document Not Found',
      description: `The requested legal document "${document}" could not be found`,
    });
  }

  try {
    // Dynamically import metadata from MDX file using Next.js 16 native approach
    const { metadata } = await import(`@/content/${document}/${locale}.mdx`);

    // Validate that metadata has required fields
    if (!metadata || typeof metadata.title !== 'string' || typeof metadata.description !== 'string') {
      throw new Error(`Invalid metadata structure for ${document}/${locale}`);
    }

    return generatePageMetadata({
      locale,
      path: `/legal/${document}`,
      title: metadata.title,
      description: metadata.description,
      ogTitle: metadata.og?.title || undefined,
      ogDescription: metadata.og?.description || undefined,
      siteName: metadata.og?.siteName || undefined,
      type: 'article',
      keywords: ['legal', document, 'eleva care', 'healthcare', 'policy'],
    });
  } catch (error) {
    console.error(`Error loading metadata from MDX for legal/${document}:`, error);
    console.warn(
      `No translations found for legal document ${document} in locale ${locale}, using fallback`,
    );

    const displayName =
      documentDisplayNames[document as keyof typeof documentDisplayNames] ||
      document.charAt(0).toUpperCase() + document.slice(1);

    return generatePageMetadata({
      locale,
      path: `/legal/${document}`,
      title: `Eleva.care - ${displayName}`,
      description: `Legal information - ${displayName}`,
      keywords: ['legal', document, 'eleva care'],
    });
  }
}

/**
 * Generates static parameters for all locale/document combinations.
 * Enables static pre-rendering of legal documents at build time.
 *
 * @returns Array of locale and document parameter combinations
 *
 * @example
 * ```tsx
 * // Returns combinations like:
 * // [{ locale: 'en', document: 'terms' }, { locale: 'en', document: 'privacy' }, ...]
 * ```
 */
export function generateStaticParams(): Array<{ locale: string; document: string }> {
  return locales.flatMap((locale) =>
    validDocuments.map((document) => ({
      locale,
      document,
    })),
  );
}

/**
 * Legal Document Page Component
 *
 * Renders legal documents (terms, privacy, cookie policy, etc.) with MDX content.
 * Validates locale and document parameters, redirecting or showing 404 as needed.
 *
 * @param params - Page parameters containing locale and document slug
 * @returns JSX element rendering the legal document
 *
 * @example
 * ```tsx
 * // Rendered by Next.js App Router for /legal/privacy
 * <LegalDocumentPage params={Promise.resolve({ locale: 'en', document: 'privacy' })} />
 * ```
 */
export default async function LegalDocumentPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale, document } = await params;

  if (!isValidLocale(locale)) {
    redirect(`/legal/${document}`); // Default locale (en) has no prefix
  }

  if (!validDocuments.includes(document as DocumentKey)) {
    return notFound();
  }

  // Native Next.js 16 MDX import - Turbopack optimized
  let LegalContent: React.ComponentType<{ components?: typeof mdxComponents }>;
  try {
    const mdxModule = await import(`@/content/${document}/${locale}.mdx`);
    LegalContent = mdxModule.default;
  } catch (error) {
    console.error(`Failed to load MDX content for ${document}/${locale}:`, error);
    return notFound();
  }

  return <LegalContent components={mdxComponents} />;
}
