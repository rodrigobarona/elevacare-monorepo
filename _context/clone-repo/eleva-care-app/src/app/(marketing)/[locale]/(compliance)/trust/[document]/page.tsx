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

/** Valid trust document slugs */
const validDocuments = ['security', 'dpa'] as const;

/** Union type of valid trust document slugs */
type DocumentKey = (typeof validDocuments)[number];

/** Mapping of document slugs to their display names */
const documentDisplayNames = {
  security: 'Security',
  dpa: 'Data Processing Agreement',
} as const satisfies Record<DocumentKey, string>;

/**
 * Generates metadata for trust document pages.
 *
 * Validates locale and document parameters via isValidLocale and validDocuments,
 * then dynamically imports MDX metadata. Falls back to display names if import fails.
 *
 * @param params - Page parameters containing locale and document slug (PageProps)
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * const metadata = await generateMetadata({
 *   params: Promise.resolve({ locale: 'en', document: 'security' })
 * });
 * // Returns: { title: 'Security', description: '...', ... }
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, document } = await params;

  if (!isValidLocale(locale) || !validDocuments.includes(document as DocumentKey)) {
    return generatePageMetadata({
      locale: 'en',
      path: '/trust/security',
      title: 'Trust Document Not Found',
      description: 'The requested trust document could not be found',
    });
  }

  try {
    // Dynamically import metadata from MDX file using Next.js 16 native approach
    const { metadata } = await import(`@/content/trust/${document}/${locale}.mdx`);

    return generatePageMetadata({
      locale,
      path: `/trust/${document}`,
      title: metadata.title,
      description: metadata.description,
      ogTitle: metadata.og?.title || undefined,
      ogDescription: metadata.og?.description || undefined,
      siteName: metadata.og?.siteName || undefined,
      type: 'article',
      keywords: ['trust', 'security', 'compliance', document, 'eleva care', 'healthcare'],
    });
  } catch (error) {
    // Log error with context about fallback behavior
    console.error(
      `Failed to load metadata for trust/${document} in locale ${locale}. Using display name fallback.`,
      error,
    );

    const displayName =
      documentDisplayNames[document as DocumentKey] ||
      document.charAt(0).toUpperCase() + document.slice(1);

    return generatePageMetadata({
      locale,
      path: `/trust/${document}`,
      title: `Eleva.care - ${displayName}`,
      description: `Trust & Security - ${displayName}`,
      keywords: ['trust', 'security', document, 'eleva care'],
    });
  }
}

/**
 * Generates static parameters for all locale/document combinations.
 * Enables static pre-rendering of trust documents at build time.
 *
 * @returns Array of locale and document parameter combinations
 *
 * @example
 * ```tsx
 * // Returns:
 * // [{ locale: 'en', document: 'security' }, { locale: 'en', document: 'dpa' }, ...]
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
 * Trust Document Page Component
 *
 * Renders trust/security documents (security policy, DPA) with MDX content.
 * Validates locale and document parameters, redirecting or showing 404 as needed.
 *
 * @param params - Page parameters containing locale and document slug
 * @returns JSX element rendering the trust document
 *
 * @example
 * ```tsx
 * // Rendered by Next.js App Router for /trust/security
 * <TrustDocumentPage params={Promise.resolve({ locale: 'en', document: 'security' })} />
 * ```
 */
export default async function TrustDocumentPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale, document } = await params;

  if (!isValidLocale(locale)) {
    redirect(`/trust/${document}`); // Default locale (en) has no prefix
    return undefined as never; // Explicit return for control flow clarity (redirect throws)
  }

  if (!validDocuments.includes(document as DocumentKey)) {
    return notFound();
  }

  // Native Next.js 16 MDX import - Turbopack optimized
  let TrustContent: React.ComponentType<{ components?: typeof mdxComponents }>;
  try {
    const mdxModule = await import(`@/content/trust/${document}/${locale}.mdx`);
    TrustContent = mdxModule.default;
  } catch (error) {
    console.error(`Failed to load MDX content for trust/${document}/${locale}:`, error);
    return notFound();
  }

  return <TrustContent components={mdxComponents} />;
}
